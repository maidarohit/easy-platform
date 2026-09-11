import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTaskAttempts, type easyModeTasks } from "@/app/db/schema";
import { evaluateFailedTaskRetryEligibility } from "@/app/lib/easy-mode-task-attempts";

export type EasyModeCustomerTaskState = "Waiting" | "In progress" | "Completed" | "Failed" | "Needs attention" | "Not needed";

export type EasyModeCustomerTask = Readonly<{
  id: string;
  moduleId: string;
  position: number;
  status: string;
  attemptCount: number;
  customerState: EasyModeCustomerTaskState;
  canRetry: boolean;
  customerMessage: string | null;
}>;

export async function customerTaskViews(
  runId: string,
  tasks: readonly (typeof easyModeTasks.$inferSelect)[],
  _options: Readonly<{ allowUncertainRecovery?: boolean }> = {},
): Promise<EasyModeCustomerTask[]> {
  void _options;
  const [run] = await db.select({
    status: easyModeRuns.status,
  }).from(easyModeRuns).where(eq(easyModeRuns.id, runId)).limit(1);
  const attempts = await db.select({
    id: easyModeTaskAttempts.id,
    taskId: easyModeTaskAttempts.taskId,
    status: easyModeTaskAttempts.status,
    attemptNumber: easyModeTaskAttempts.attemptNumber,
    safeErrorCode: easyModeTaskAttempts.safeErrorCode,
  }).from(easyModeTaskAttempts).where(eq(easyModeTaskAttempts.runId, runId))
    .orderBy(desc(easyModeTaskAttempts.attemptNumber));
  const [activeAttempt] = await db.select({
    id: easyModeTaskAttempts.id,
  }).from(easyModeTaskAttempts).where(and(
    eq(easyModeTaskAttempts.runId, runId),
    inArray(easyModeTaskAttempts.status, ["claimed", "dispatching", "running"]),
  )).limit(1);
  const latestAttempt = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttempt.has(attempt.taskId)) latestAttempt.set(attempt.taskId, attempt);
  }

  return tasks.map((task) => {
    const attempt = latestAttempt.get(task.id);
    const eligibility = evaluateFailedTaskRetryEligibility({
      runStatus: run?.status ?? null,
      taskId: task.id,
      taskStatus: task.status,
      projectOutputId: task.projectOutputId,
      attemptId: attempt?.id ?? null,
      attemptTaskId: attempt?.taskId ?? null,
      attemptStatus: attempt?.status ?? null,
      attemptSafeErrorCode: attempt?.safeErrorCode ?? null,
      latestAttemptId: attempt?.id ?? null,
      activeAttemptId: activeAttempt?.id ?? null,
    });
    const uncertain = task.status === "failed" && attempt?.status === "failed_uncertain";
    const canRetry = eligibility.allowed;
    const customerState: EasyModeCustomerTaskState = task.status === "completed" ? "Completed" :
      task.status === "running" ? "In progress" :
        task.status === "skipped" ? "Not needed" :
          task.status === "failed" ? canRetry ? "Failed" : "Needs attention" : "Waiting";
    const customerMessage = canRetry
      ? attempt?.status === "failed_uncertain"
          ? "We could not confirm whether this step finished. You can safely retry this phase."
          : "This step could not start. You can safely try again."
      : uncertain
        ? eligibility.reason === "active_attempt"
          ? "This step is already being handled."
          : "We could not confirm whether this step finished. Please contact support before trying again."
        : task.status === "failed"
          ? eligibility.reason === "active_attempt"
            ? "This step is already being handled."
            : "This step needs attention before it can continue."
          : null;
    return {
      id: task.id,
      moduleId: task.moduleId,
      position: task.position,
      status: task.status,
      attemptCount: task.attemptCount,
      customerState,
      canRetry,
      customerMessage,
    };
  });
}
