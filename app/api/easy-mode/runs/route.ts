import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { allowanceError, checkUsageAllowance } from "@/app/lib/paid-entitlements";
import { categoryForModule, type UsageCategory } from "@/app/lib/plan-config";
import { resolveEasyModePlan } from "@/app/lib/easy-mode-plans";
import { validateEasyModeProjectId, validateEasyModeRunCreateBody } from "@/app/lib/easy-mode-run-validation";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_BODY_BYTES = 4 * 1024;
const SAFE_ERROR_CODES = new Set(["TASK_FAILED", "OUTPUT_INVALID", "LIMIT_REACHED", "CANCELLED"]);

function taskResponse(task: typeof easyModeTasks.$inferSelect) {
  return {
    id: task.id,
    moduleId: task.moduleId,
    position: task.position,
    status: task.status,
    attemptCount: task.attemptCount,
    safeErrorCode: task.safeErrorCode && SAFE_ERROR_CODES.has(task.safeErrorCode) ? task.safeErrorCode : null,
  };
}

async function responseForRun(run: typeof easyModeRuns.$inferSelect) {
  const tasks = await db.select().from(easyModeTasks)
    .where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
  return {
    run: { id: run.id, projectId: run.projectId, goalId: run.goalId, status: run.status, createdAt: run.createdAt },
    tasks: tasks.map(taskResponse),
    progress: { total: tasks.length, queued: tasks.filter((task) => task.status === "queued").length, completed: tasks.filter((task) => task.status === "completed").length, failed: tasks.filter((task) => task.status === "failed").length },
  };
}

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId), eq(projects.userId, userId),
  )).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const [run] = await db.select().from(easyModeRuns).where(and(
    eq(easyModeRuns.userId, userId),
    eq(easyModeRuns.projectId, projectId),
    inArray(easyModeRuns.status, ["queued", "running"]),
  )).orderBy(desc(easyModeRuns.createdAt)).limit(1);
  if (!run) return Response.json({ run: null, tasks: [], progress: null });
  return Response.json(await responseForRun(run), { headers: { "Cache-Control": "no-store" } });
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
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid request." }, { status: 400 });
    throw error;
  }

  const body = validateEasyModeRunCreateBody(parsed);
  const plan = body && resolveEasyModePlan(body.goalId);
  if (!body || !plan) return Response.json({ error: "Invalid build request." }, { status: 400 });

  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const [existingRun] = await db.select().from(easyModeRuns).where(and(
    eq(easyModeRuns.userId, userId),
    eq(easyModeRuns.projectId, body.projectId),
    eq(easyModeRuns.idempotencyKey, body.idempotencyKey),
  )).limit(1);
  if (existingRun) return Response.json(await responseForRun(existingRun));

  const categories = [...new Set(plan.map((moduleId) => categoryForModule(moduleId)))] as UsageCategory[];
  for (const category of categories) {
    const allowance = await checkUsageAllowance(userId, category);
    if (!allowance.ok) return allowanceError(allowance);
  }

  const result = await db.transaction(async (transaction) => {
    const [createdRun] = await transaction.insert(easyModeRuns).values({
      userId,
      projectId: body.projectId,
      goalId: body.goalId,
      status: "queued",
      idempotencyKey: body.idempotencyKey,
    }).onConflictDoNothing({
      target: [easyModeRuns.userId, easyModeRuns.projectId, easyModeRuns.idempotencyKey],
    }).returning();

    if (!createdRun) return null;
    const tasks = await transaction.insert(easyModeTasks).values(
      plan.map((moduleId, position) => ({ runId: createdRun.id, moduleId, position, status: "queued" as const })),
    ).returning();
    return { run: createdRun, tasks };
  });

  if (!result) {
    const [run] = await db.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.userId, userId),
      eq(easyModeRuns.projectId, body.projectId),
      eq(easyModeRuns.idempotencyKey, body.idempotencyKey),
    )).limit(1);
    if (!run) return Response.json({ error: "Unable to prepare your business build." }, { status: 500 });
    return Response.json(await responseForRun(run));
  }

  return Response.json({
    run: { id: result.run.id, projectId: result.run.projectId, goalId: result.run.goalId, status: result.run.status, createdAt: result.run.createdAt },
    tasks: result.tasks.map(taskResponse),
    progress: { total: result.tasks.length, queued: result.tasks.length, completed: 0, failed: 0 },
  }, { status: 201 });
}
