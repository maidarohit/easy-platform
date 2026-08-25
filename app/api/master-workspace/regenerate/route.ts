import { and, asc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projectOutputs, projects } from "@/app/db/schema";
import {
  MODULE_ALIASES,
  type WorkspaceModule,
  validatedWorkspaceOutput,
} from "@/app/api/master-workspace/route";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { resolveEasyModePlan } from "@/app/lib/easy-mode-plans";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { allowanceError, checkUsageAllowance } from "@/app/lib/paid-entitlements";
import { categoryForModule } from "@/app/lib/plan-config";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import type { EasyModeGoalId } from "@/app/lib/easy-mode-goal-options";

const MAX_BODY_BYTES = 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REGENERATION_GOALS: Readonly<Record<WorkspaceModule, EasyModeGoalId>> = {
  branding: "build_brand",
  logo: "build_brand",
  content: "build_brand",
  website: "build_website",
  seo: "build_website",
  uiux: "build_website",
  marketing: "improve_business",
  sales: "improve_business",
  analytics: "improve_business",
  "ai-manager": "improve_business",
};

function runResponse(
  run: typeof easyModeRuns.$inferSelect,
  tasks: readonly (typeof easyModeTasks.$inferSelect)[],
) {
  return {
    run: { id: run.id, projectId: run.projectId, status: run.status },
    tasks: tasks.map((task) => ({
      id: task.id,
      moduleId: task.moduleId,
      status: task.status,
    })),
  };
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }
    if (error instanceof MalformedJsonBodyError) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const values = parsed as Record<string, unknown>;
  const projectId = validateEasyModeProjectId(values.projectId);
  const outputId = typeof values.outputId === "string" && UUID_PATTERN.test(values.outputId)
    ? values.outputId.toLowerCase()
    : null;
  if (!projectId || !outputId || Object.keys(values).some((key) => !["projectId", "outputId"].includes(key))) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const [ownedProject] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId),
    eq(projects.userId, userId),
  )).limit(1);
  if (!ownedProject) return Response.json({ error: "Project not found." }, { status: 404 });

  const [sourceOutput] = await db.select({
    id: projectOutputs.id,
    module: projectOutputs.module,
    result: projectOutputs.result,
  }).from(projectOutputs).where(and(
    eq(projectOutputs.id, outputId),
    eq(projectOutputs.projectId, projectId),
    eq(projectOutputs.userId, userId),
  )).limit(1);
  const moduleId = sourceOutput && MODULE_ALIASES[sourceOutput.module.toLowerCase()];
  if (!sourceOutput || !moduleId || !validatedWorkspaceOutput(moduleId, sourceOutput.result)) {
    return Response.json({ error: "Generated output not found." }, { status: 404 });
  }

  const idempotencyKey = `workspace-regenerate:${sourceOutput.id}`;
  const [priorRun] = await db.select().from(easyModeRuns).where(and(
    eq(easyModeRuns.userId, userId),
    eq(easyModeRuns.projectId, projectId),
    eq(easyModeRuns.idempotencyKey, idempotencyKey),
  )).limit(1);
  if (priorRun) {
    const priorTasks = await db.select().from(easyModeTasks)
      .where(eq(easyModeTasks.runId, priorRun.id)).orderBy(asc(easyModeTasks.position));
    return Response.json(runResponse(priorRun, priorTasks), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const allowance = await checkUsageAllowance(userId, categoryForModule(moduleId));
  if (!allowance.ok) return allowanceError(allowance);

  const goalId = REGENERATION_GOALS[moduleId];
  const plan = resolveEasyModePlan(goalId);
  if (!plan || !plan.includes(moduleId)) {
    return Response.json({ error: "This output cannot be regenerated." }, { status: 409 });
  }
  const created = await db.transaction(async (transaction) => {
    const [run] = await transaction.insert(easyModeRuns).values({
      userId,
      projectId,
      goalId,
      status: "queued",
      idempotencyKey,
    }).onConflictDoNothing({
      target: [easyModeRuns.userId, easyModeRuns.projectId, easyModeRuns.idempotencyKey],
    }).returning();
    if (!run) return null;

    const tasks = await transaction.insert(easyModeTasks).values(plan.map((plannedModule, position) => ({
      runId: run.id,
      moduleId: plannedModule,
      position,
      status: plannedModule === moduleId ? "queued" as const : "skipped" as const,
      completedAt: plannedModule === moduleId ? null : new Date(),
    }))).returning();
    return { run, tasks };
  });

  if (created) {
    return Response.json(runResponse(created.run, created.tasks), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [existingRun] = await db.select().from(easyModeRuns).where(and(
    eq(easyModeRuns.userId, userId),
    eq(easyModeRuns.projectId, projectId),
    eq(easyModeRuns.idempotencyKey, idempotencyKey),
  )).limit(1);
  if (!existingRun) {
    return Response.json({ error: "Unable to prepare regeneration." }, { status: 500 });
  }
  const existingTasks = await db.select().from(easyModeTasks)
    .where(eq(easyModeTasks.runId, existingRun.id)).orderBy(asc(easyModeTasks.position));
  return Response.json(runResponse(existingRun, existingTasks), {
    headers: { "Cache-Control": "no-store" },
  });
}
