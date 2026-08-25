import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeTaskAttempts, type easyModeTasks } from "@/app/db/schema";
import { canExplicitlyRetryAttempt } from "@/app/lib/easy-mode-task-attempts";

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
): Promise<EasyModeCustomerTask[]> {
  const attempts = await db.select({
    taskId: easyModeTaskAttempts.taskId,
    status: easyModeTaskAttempts.status,
    attemptNumber: easyModeTaskAttempts.attemptNumber,
  }).from(easyModeTaskAttempts).where(eq(easyModeTaskAttempts.runId, runId))
    .orderBy(desc(easyModeTaskAttempts.attemptNumber));
  const latestAttempt = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttempt.has(attempt.taskId)) latestAttempt.set(attempt.taskId, attempt);
  }

  return tasks.map((task) => {
    const attempt = latestAttempt.get(task.id);
    const canRetry = task.status === "failed" && Boolean(attempt && canExplicitlyRetryAttempt(attempt.status));
    const uncertain = task.status === "failed" && attempt?.status === "failed_uncertain";
    const customerState: EasyModeCustomerTaskState = task.status === "completed" ? "Completed" :
      task.status === "running" ? "In progress" :
        task.status === "skipped" ? "Not needed" :
          task.status === "failed" ? canRetry ? "Failed" : "Needs attention" : "Waiting";
    const customerMessage = canRetry
      ? "This step could not start. You can safely try again."
      : uncertain
        ? "We could not confirm whether this step finished. Please contact support before trying again."
        : task.status === "failed"
          ? "This step needs attention before it can continue."
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
