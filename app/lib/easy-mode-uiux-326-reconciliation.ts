import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import {
  aiUsage,
  easyModeRuns,
  easyModeTaskAttempts,
  easyModeTasks,
  projectMemory,
  projectOutputs,
  projects,
} from "@/app/db/schema";
import { validateUiuxOutput } from "@/app/lib/easy-mode-execution-contracts";
import { deriveEasyModeRunStatus } from "@/app/lib/easy-mode-task-attempts";

export const UIUX_326_RUN_ID = "0882c7a2-490b-4837-ab21-3ea1a4ba83e3";
export const UIUX_326_PROJECT_ID = "39012ee0-6fea-4841-b99f-793727a045a1";
export const UIUX_326_EXECUTION_KEY = "4e159131-0da3-46e7-96e4-5e28cd982df4";

export type Uiux326ReconciliationResult = Readonly<{
  state: "reconciled" | "already_reconciled";
  outputId: string;
  usageId: string;
  nextModule: string | null;
}>;

type ReconciliationWriter = (
  output: Readonly<Record<string, string>>,
) => Promise<Uiux326ReconciliationResult>;

export async function reconcileEasyModeUiux326(
  response: unknown,
  writer: ReconciliationWriter = persistUiux326Reconciliation,
) {
  const responseItem = Array.isArray(response) && response.length === 1 ? response[0] : response;
  const output = validateUiuxOutput(responseItem);
  if (!output) throw new Error("UIUX #326 result does not satisfy the production contract.");
  return writer(output);
}

async function persistUiux326Reconciliation(
  output: Readonly<Record<string, string>>,
): Promise<Uiux326ReconciliationResult> {
  return db.transaction(async (transaction) => {
    const [run] = await transaction.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.id, UIUX_326_RUN_ID),
      eq(easyModeRuns.projectId, UIUX_326_PROJECT_ID),
    )).limit(1).for("update");
    if (!run) throw new Error("UIUX #326 run does not match.");

    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
      eq(easyModeTaskAttempts.executionKey, UIUX_326_EXECUTION_KEY),
      eq(easyModeTaskAttempts.runId, UIUX_326_RUN_ID),
      eq(easyModeTaskAttempts.projectId, UIUX_326_PROJECT_ID),
    )).limit(1).for("update");
    if (!attempt?.usageId) throw new Error("UIUX #326 attempt does not match.");

    const [task] = await transaction.select().from(easyModeTasks).where(and(
      eq(easyModeTasks.id, attempt.taskId),
      eq(easyModeTasks.runId, UIUX_326_RUN_ID),
      eq(easyModeTasks.moduleId, "uiux"),
    )).limit(1).for("update");
    if (!task) throw new Error("UIUX #326 task does not match.");

    const tasks = await transaction.select().from(easyModeTasks)
      .where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
    const nextModule = () => tasks.find((item) => item.position > task.position && item.status === "queued")?.moduleId ?? null;

    if (attempt.status === "completed" && task.status === "completed" && task.projectOutputId) {
      const [existing] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.id, task.projectOutputId),
        eq(projectOutputs.projectId, UIUX_326_PROJECT_ID),
        eq(projectOutputs.userId, attempt.userId),
        eq(projectOutputs.module, "uiux"),
      )).limit(1);
      const [existingUsage] = await transaction.select().from(aiUsage).where(and(
        eq(aiUsage.id, attempt.usageId),
        eq(aiUsage.userId, attempt.userId),
        eq(aiUsage.projectId, UIUX_326_PROJECT_ID),
        eq(aiUsage.module, "uiux"),
        eq(aiUsage.status, "success"),
      )).limit(1);
      let existingOutput: unknown;
      try { existingOutput = JSON.parse(existing?.result ?? ""); } catch { existingOutput = null; }
      if (!existing || !existingUsage || !validateUiuxOutput(existingOutput)) {
        throw new Error("Completed UIUX #326 output is invalid.");
      }
      return {
        state: "already_reconciled", outputId: existing.id,
        usageId: attempt.usageId, nextModule: nextModule(),
      };
    }

    if (attempt.status !== "failed_uncertain" || attempt.safeErrorCode !== "DELIVERY_UNCERTAIN" ||
        task.status !== "failed" || task.safeErrorCode !== "DELIVERY_UNCERTAIN" || task.projectOutputId) {
      throw new Error("UIUX #326 is not safely reconcilable.");
    }

    const [usage] = await transaction.select().from(aiUsage).where(eq(aiUsage.id, attempt.usageId)).limit(1).for("update");
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, UIUX_326_PROJECT_ID), eq(projects.userId, attempt.userId),
    )).limit(1).for("update");
    if (!usage || !project || usage.userId !== attempt.userId || usage.projectId !== UIUX_326_PROJECT_ID ||
        usage.module !== "uiux" || usage.status !== "failed") {
      throw new Error("Original UIUX #326 usage is not safely reconcilable.");
    }

    const [created] = await transaction.insert(projectOutputs).values({
      projectId: UIUX_326_PROJECT_ID,
      userId: attempt.userId,
      module: "uiux",
      result: JSON.stringify(output),
      approvedAt: null,
    }).returning({ id: projectOutputs.id });
    if (!created) throw new Error("UIUX #326 output persistence failed.");

    const summary = `Customer experience: ${output.uiuxStrategy.slice(0, 750)}`;
    const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
      .from(projectMemory).where(and(
        eq(projectMemory.projectId, UIUX_326_PROJECT_ID), eq(projectMemory.userId, attempt.userId),
      )).limit(1).for("update");
    const prior = memory?.additionalContext?.trim().slice(-1_000);
    const additionalContext = [prior, summary].filter(Boolean).join("\n");
    if (memory) {
      await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() })
        .where(eq(projectMemory.id, memory.id));
    } else {
      await transaction.insert(projectMemory).values({
        projectId: UIUX_326_PROJECT_ID, userId: attempt.userId, additionalContext,
      });
    }

    const now = new Date();
    const [completedAttempt] = await transaction.update(easyModeTaskAttempts).set({
      status: "completed", finishedAt: now, safeErrorCode: null,
    }).where(and(
      eq(easyModeTaskAttempts.id, attempt.id), eq(easyModeTaskAttempts.status, "failed_uncertain"),
    )).returning({ id: easyModeTaskAttempts.id });
    const [completedTask] = await transaction.update(easyModeTasks).set({
      status: "completed", projectOutputId: created.id, completedAt: now, failedAt: null, safeErrorCode: null,
    }).where(and(eq(easyModeTasks.id, task.id), eq(easyModeTasks.status, "failed")))
      .returning({ id: easyModeTasks.id });
    const [completedUsage] = await transaction.update(aiUsage).set({ status: "success" }).where(and(
      eq(aiUsage.id, usage.id), eq(aiUsage.status, "failed"),
    )).returning({ id: aiUsage.id });
    if (!completedAttempt || !completedTask || !completedUsage) {
      throw new Error("UIUX #326 reconciliation raced with another update.");
    }

    const statuses = tasks.map((item) => item.id === task.id ? "completed" : item.status);
    const runStatus = deriveEasyModeRunStatus(statuses);
    await transaction.update(easyModeRuns).set({
      status: runStatus,
      failedAt: null,
      ...(runStatus === "completed" ? { completedAt: now } : { completedAt: null }),
    }).where(and(eq(easyModeRuns.id, run.id), eq(easyModeRuns.projectId, UIUX_326_PROJECT_ID)));

    return { state: "reconciled", outputId: created.id, usageId: usage.id, nextModule: nextModule() };
  });
}
