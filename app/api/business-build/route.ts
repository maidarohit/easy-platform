import { and, asc, desc, eq, like } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projectBusinessDna, projects } from "@/app/db/schema";
import { customerTaskViews } from "@/app/lib/easy-mode-customer-status";
import { easyModeQuotaError, preflightEasyModePlanQuota } from "@/app/lib/easy-mode-quota-preflight";
import { resolveEasyModePlan } from "@/app/lib/easy-mode-plans";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_BODY_BYTES = 1024;
const BUILD_GOAL = "build_everything" as const;
const BUILD_KEY_PREFIX = "business-dna-build:";

type BuildRun = typeof easyModeRuns.$inferSelect;
type BuildDna = Pick<typeof projectBusinessDna.$inferSelect, "confirmed" | "revisionCount" | "dna">;

export type BusinessBuildDependencies = Readonly<{
  verify: (request: Request) => Promise<{ uid: string }>;
  loadDna: (userId: string, projectId: string) => Promise<BuildDna | null>;
  findRun: (userId: string, projectId: string, idempotencyKey?: string) => Promise<BuildRun | null>;
  preflight: typeof preflightEasyModePlanQuota;
  createRun: (input: { userId: string; projectId: string; idempotencyKey: string }) => Promise<BuildRun | null>;
  responseForRun: (run: BuildRun) => Promise<unknown>;
}>;

async function loadOwnedConfirmedDna(userId: string, projectId: string) {
  const [row] = await db.select({
    confirmed: projectBusinessDna.confirmed,
    revisionCount: projectBusinessDna.revisionCount,
    dna: projectBusinessDna.dna,
  }).from(projects).innerJoin(projectBusinessDna, and(
    eq(projectBusinessDna.projectId, projects.id), eq(projectBusinessDna.userId, userId),
  )).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return row ?? null;
}

async function findBusinessBuildRun(userId: string, projectId: string, idempotencyKey?: string) {
  const conditions = [eq(easyModeRuns.userId, userId), eq(easyModeRuns.projectId, projectId)];
  conditions.push(idempotencyKey ? eq(easyModeRuns.idempotencyKey, idempotencyKey) : like(easyModeRuns.idempotencyKey, `${BUILD_KEY_PREFIX}%`));
  const [run] = await db.select().from(easyModeRuns).where(and(...conditions)).orderBy(desc(easyModeRuns.createdAt)).limit(1);
  return run ?? null;
}

async function responseForBusinessBuild(run: BuildRun) {
  const tasks = await db.select().from(easyModeTasks).where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
  return {
    run: { id: run.id, projectId: run.projectId, status: run.status, createdAt: run.createdAt },
    tasks: await customerTaskViews(run.id, tasks),
    progress: {
      total: tasks.length, queued: tasks.filter((task) => task.status === "queued").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      failed: tasks.filter((task) => task.status === "failed").length,
    },
  };
}

async function createBusinessBuildRun(input: { userId: string; projectId: string; idempotencyKey: string }) {
  const plan = resolveEasyModePlan(BUILD_GOAL);
  if (!plan) return null;
  return db.transaction(async (transaction) => {
    const [run] = await transaction.insert(easyModeRuns).values({
      userId: input.userId, projectId: input.projectId, goalId: BUILD_GOAL,
      status: "queued", idempotencyKey: input.idempotencyKey,
    }).onConflictDoNothing({
      target: [easyModeRuns.userId, easyModeRuns.projectId, easyModeRuns.idempotencyKey],
    }).returning();
    if (!run) return null;
    await transaction.insert(easyModeTasks).values(plan.map((moduleId, position) => ({ runId: run.id, moduleId, position, status: "queued" as const })));
    return run;
  });
}

const defaultDependencies: BusinessBuildDependencies = {
  verify: verifyFirebaseIdToken, loadDna: loadOwnedConfirmedDna, findRun: findBusinessBuildRun,
  preflight: preflightEasyModePlanQuota, createRun: createBusinessBuildRun, responseForRun: responseForBusinessBuild,
};

function buildKey(revisionCount: number) {
  return `${BUILD_KEY_PREFIX}${revisionCount}`;
}

async function authenticated(request: Request, dependencies: BusinessBuildDependencies) {
  try { return (await dependencies.verify(request)).uid; } catch { return null; }
}

export async function handleBusinessBuildGet(request: Request, dependencies: BusinessBuildDependencies = defaultDependencies) {
  const userId = await authenticated(request, dependencies);
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const dna = await dependencies.loadDna(userId, projectId);
  if (!dna) return Response.json({ error: "Project not found." }, { status: 404 });
  const run = await dependencies.findRun(userId, projectId);
  if (run) return Response.json({ ...(await dependencies.responseForRun(run) as Record<string, unknown>), eligible: true, confirmed: dna.confirmed }, { headers: { "Cache-Control": "no-store" } });
  if (!dna.confirmed) return Response.json({ run: null, tasks: [], progress: null, eligible: false, confirmed: false });
  const plan = resolveEasyModePlan(BUILD_GOAL);
  if (!plan) return Response.json({ run: null, tasks: [], progress: null, eligible: false, confirmed: true });
  const allowance = await dependencies.preflight(userId, plan);
  return Response.json({ run: null, tasks: [], progress: null, eligible: allowance.ok, confirmed: true });
}

export async function handleBusinessBuildPost(request: Request, dependencies: BusinessBuildDependencies = defaultDependencies) {
  const userId = await authenticated(request, dependencies);
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  let value: unknown;
  try { value = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid build request." }, { status: 400 });
    throw error;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => key !== "projectId")) {
    return Response.json({ error: "Invalid build request." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId((value as { projectId?: unknown }).projectId);
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const dna = await dependencies.loadDna(userId, projectId);
  if (!dna) return Response.json({ error: "Project not found." }, { status: 404 });
  if (!dna.confirmed) return Response.json({ error: "Confirm your Business DNA before building.", code: "BUSINESS_DNA_NOT_CONFIRMED" }, { status: 409 });

  const idempotencyKey = buildKey(dna.revisionCount);
  const active = await dependencies.findRun(userId, projectId);
  if (active && !["completed", "cancelled"].includes(active.status)) {
    return Response.json(await dependencies.responseForRun(active));
  }
  const existing = await dependencies.findRun(userId, projectId, idempotencyKey);
  if (existing) return Response.json(await dependencies.responseForRun(existing));
  const plan = resolveEasyModePlan(BUILD_GOAL);
  if (!plan) return Response.json({ error: "Business build is unavailable." }, { status: 503 });
  const allowance = await dependencies.preflight(userId, plan);
  if (!allowance.ok) return easyModeQuotaError(allowance);
  const created = await dependencies.createRun({ userId, projectId, idempotencyKey });
  const run = created ?? await dependencies.findRun(userId, projectId, idempotencyKey);
  if (!run) return Response.json({ error: "Unable to prepare your business build." }, { status: 500 });
  return Response.json(await dependencies.responseForRun(run), { status: created ? 201 : 200 });
}

export const GET = (request: Request) => handleBusinessBuildGet(request);
export const POST = (request: Request) => handleBusinessBuildPost(request);
