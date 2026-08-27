import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTaskAttempts, easyModeTasks, projectOutputs, projects } from "@/app/db/schema";

export const RECOVERY_RUN_ID = "3b5ce170-207e-4762-b285-c4b03aaa61f8";
export const RECOVERY_PROJECT_ID = "c12c5fc5-d24c-46d9-bdde-5417005e11b2";
export const RECOVERY_SALES_TASK_ID = "795d7009-d9fc-4844-831b-62d01687f689";

export type RecoveryEvidence = Readonly<{
  run: { id: string; projectId: string; userId: string; status: string; createdAt: Date } | null;
  projectOwnerId: string | null;
  tasks: readonly { id: string; moduleId: string; position: number; status: string; projectOutputId: string | null }[];
  attempt: { id: string; taskId: string; runId: string; projectId: string; userId: string; status: string; providerExecutionId: string | null; usageId: string | null } | null;
  salesOutputsSinceRun: number;
}>;

export function validateClaimedSalesRecovery(evidence: RecoveryEvidence, userId: string) {
  const { run, tasks, attempt } = evidence;
  if (!run || run.id !== RECOVERY_RUN_ID || run.projectId !== RECOVERY_PROJECT_ID || run.userId !== userId || evidence.projectOwnerId !== userId || run.status !== "running") return null;
  const sales = tasks.filter((task) => task.id === RECOVERY_SALES_TASK_ID && task.moduleId === "sales");
  const completed = tasks.filter((task) => task.status === "completed");
  if (tasks.length !== 7 || completed.length !== 6 || sales.length !== 1 || sales[0].position !== 6 || sales[0].status !== "running" || sales[0].projectOutputId !== null ||
      tasks.some((task) => task.id !== RECOVERY_SALES_TASK_ID && task.status !== "completed") || evidence.salesOutputsSinceRun !== 0 ||
      !attempt || attempt.taskId !== RECOVERY_SALES_TASK_ID || attempt.runId !== RECOVERY_RUN_ID || attempt.projectId !== RECOVERY_PROJECT_ID || attempt.userId !== userId ||
      attempt.status !== "claimed" || attempt.providerExecutionId !== null || attempt.usageId !== null) return null;
  return { valid: true as const, runStatus: "running" as const, salesStatus: "running" as const, attemptStatus: "claimed" as const, completedTasks: 6 as const, preDispatch: true as const };
}

async function readEvidence(transaction: Parameters<Parameters<typeof db.transaction>[0]>[0], lock: boolean): Promise<RecoveryEvidence> {
  const runQuery = transaction.select({ id: easyModeRuns.id, projectId: easyModeRuns.projectId, userId: easyModeRuns.userId, status: easyModeRuns.status, createdAt: easyModeRuns.createdAt }).from(easyModeRuns).where(and(eq(easyModeRuns.id, RECOVERY_RUN_ID), eq(easyModeRuns.projectId, RECOVERY_PROJECT_ID))).limit(1);
  const runs = lock ? await runQuery.for("update") : await runQuery;
  const tasksQuery = transaction.select({ id: easyModeTasks.id, moduleId: easyModeTasks.moduleId, position: easyModeTasks.position, status: easyModeTasks.status, projectOutputId: easyModeTasks.projectOutputId }).from(easyModeTasks).where(eq(easyModeTasks.runId, RECOVERY_RUN_ID)).orderBy(asc(easyModeTasks.position));
  const tasks = lock ? await tasksQuery.for("update") : await tasksQuery;
  const attemptQuery = transaction.select({ id: easyModeTaskAttempts.id, taskId: easyModeTaskAttempts.taskId, runId: easyModeTaskAttempts.runId, projectId: easyModeTaskAttempts.projectId, userId: easyModeTaskAttempts.userId, status: easyModeTaskAttempts.status, providerExecutionId: easyModeTaskAttempts.providerExecutionId, usageId: easyModeTaskAttempts.usageId }).from(easyModeTaskAttempts).where(and(eq(easyModeTaskAttempts.taskId, RECOVERY_SALES_TASK_ID), eq(easyModeTaskAttempts.runId, RECOVERY_RUN_ID))).orderBy(desc(easyModeTaskAttempts.attemptNumber)).limit(1);
  const attempts = lock ? await attemptQuery.for("update") : await attemptQuery;
  const [project] = await transaction.select({ userId: projects.userId }).from(projects).where(eq(projects.id, RECOVERY_PROJECT_ID)).limit(1);
  const createdAt = runs[0]?.createdAt ?? new Date(0);
  const [outputCount] = await transaction.select({ total: sql<number>`count(*)` }).from(projectOutputs).where(and(eq(projectOutputs.projectId, RECOVERY_PROJECT_ID), eq(projectOutputs.module, "sales"), gte(projectOutputs.createdAt, createdAt)));
  return { run: runs[0] ?? null, projectOwnerId: project?.userId ?? null, tasks, attempt: attempts[0] ?? null, salesOutputsSinceRun: Number(outputCount?.total ?? 0) };
}

export async function validateCurrentClaimedSales(userId: string) { return db.transaction(async (transaction) => validateClaimedSalesRecovery(await readEvidence(transaction, false), userId)); }

export async function releaseClaimedSalesForOneRetry(userId: string) {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`boss-sales-recovery:${RECOVERY_RUN_ID}`}))`);
    const evidence = await readEvidence(transaction, true); const valid = validateClaimedSalesRecovery(evidence, userId); if (!valid) return null;
    const now = new Date();
    const [failedAttempt] = await transaction.update(easyModeTaskAttempts).set({ status: "failed_before_dispatch", finishedAt: now, safeErrorCode: "TASK_FAILED" }).where(and(eq(easyModeTaskAttempts.id, evidence.attempt!.id), eq(easyModeTaskAttempts.status, "claimed"), sql`${easyModeTaskAttempts.providerExecutionId} is null`, sql`${easyModeTaskAttempts.usageId} is null`)).returning({ id: easyModeTaskAttempts.id });
    if (!failedAttempt) return null;
    const [released] = await transaction.update(easyModeTasks).set({ status: "queued", startedAt: null, completedAt: null, failedAt: null, safeErrorCode: null }).where(and(eq(easyModeTasks.id, RECOVERY_SALES_TASK_ID), eq(easyModeTasks.status, "running"), sql`${easyModeTasks.projectOutputId} is null`)).returning({ id: easyModeTasks.id });
    if (!released) throw new Error("RECOVERY_STATE_CHANGED");
    return { released: true as const, previousAttemptId: failedAttempt.id };
  });
}
