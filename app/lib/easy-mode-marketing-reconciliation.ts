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
import { validateMarketingOutput } from "@/app/lib/easy-mode-execution-contracts";
import { deriveEasyModeRunStatus } from "@/app/lib/easy-mode-task-attempts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MarketingReconciliationInput = Readonly<{
  runId: string;
  projectId: string;
  executionKey: string;
  response: unknown;
}>;

export type MarketingReconciliationResult = Readonly<{
  state: "reconciled" | "already_reconciled";
  outputId: string;
  usageId: string;
  nextModule: string | null;
}>;

type ReconciliationWriter = (
  input: Omit<MarketingReconciliationInput, "response">,
  output: Readonly<Record<string, unknown>>,
) => Promise<MarketingReconciliationResult>;

export async function reconcileEasyModeMarketingResult(
  input: MarketingReconciliationInput,
  writer: ReconciliationWriter = persistMarketingReconciliation,
) {
  if (!UUID.test(input.runId) || !UUID.test(input.projectId) || !UUID.test(input.executionKey)) {
    throw new Error("Invalid reconciliation identifiers.");
  }
  const responseItem = Array.isArray(input.response) && input.response.length === 1
    ? input.response[0]
    : input.response;
  const output = validateMarketingOutput(responseItem);
  if (!output) throw new Error("Marketing result does not satisfy the production contract.");
  return writer({ runId: input.runId, projectId: input.projectId, executionKey: input.executionKey }, output);
}

async function persistMarketingReconciliation(
  input: Omit<MarketingReconciliationInput, "response">,
  output: Readonly<Record<string, unknown>>,
): Promise<MarketingReconciliationResult> {
  return db.transaction(async (transaction) => {
    const [run] = await transaction.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.id, input.runId), eq(easyModeRuns.projectId, input.projectId),
    )).limit(1).for("update");
    if (!run) throw new Error("Easy Mode run does not match the requested reconciliation.");
    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(
      eq(easyModeTaskAttempts.executionKey, input.executionKey),
    ).limit(1).for("update");
    if (!attempt || attempt.runId !== input.runId || attempt.projectId !== input.projectId || !attempt.usageId) {
      throw new Error("Marketing attempt does not match the requested reconciliation.");
    }
    const [task] = await transaction.select().from(easyModeTasks).where(
      eq(easyModeTasks.id, attempt.taskId),
    ).limit(1).for("update");
    if (!task || task.runId !== run.id || task.moduleId !== "marketing") {
      throw new Error("Marketing task does not match the requested reconciliation.");
    }

    const tasks = await transaction.select().from(easyModeTasks).where(
      eq(easyModeTasks.runId, run.id),
    ).orderBy(asc(easyModeTasks.position));
    const nextModule = () => tasks.find((item) => item.position > task.position && item.status === "queued")?.moduleId ?? null;
    if (attempt.status === "completed" && task.status === "completed" && task.projectOutputId) {
      const [existing] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.id, task.projectOutputId),
        eq(projectOutputs.projectId, input.projectId),
        eq(projectOutputs.userId, attempt.userId),
        eq(projectOutputs.module, "marketing"),
      )).limit(1);
      let existingOutput: unknown;
      try { existingOutput = JSON.parse(existing?.result ?? ""); } catch { existingOutput = null; }
      if (!existing || !validateMarketingOutput(existingOutput)) throw new Error("Completed reconciliation output is invalid.");
      return { state: "already_reconciled", outputId: existing.id, usageId: attempt.usageId, nextModule: nextModule() };
    }
    if (attempt.status !== "failed_uncertain" || attempt.safeErrorCode !== "DELIVERY_UNCERTAIN" ||
        task.status !== "failed" || task.safeErrorCode !== "DELIVERY_UNCERTAIN" || task.projectOutputId) {
      throw new Error("Marketing attempt is not safely reconcilable.");
    }

    const [usage] = await transaction.select().from(aiUsage).where(eq(aiUsage.id, attempt.usageId)).limit(1).for("update");
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, input.projectId), eq(projects.userId, attempt.userId),
    )).limit(1).for("update");
    if (!usage || !project || usage.userId !== attempt.userId || usage.projectId !== input.projectId ||
        usage.module !== "marketing" || usage.status !== "failed") {
      throw new Error("Original Marketing usage is not safely reconcilable.");
    }

    const [created] = await transaction.insert(projectOutputs).values({
      projectId: input.projectId,
      userId: attempt.userId,
      module: "marketing",
      result: JSON.stringify(output),
      approvedAt: null,
    }).returning({ id: projectOutputs.id });
    if (!created) throw new Error("Marketing output persistence failed.");

    const summary = `Marketing: ${String(output.marketingStrategy).slice(0, 750)}`;
    const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
      .from(projectMemory).where(and(
        eq(projectMemory.projectId, input.projectId), eq(projectMemory.userId, attempt.userId),
      )).limit(1).for("update");
    const prior = memory?.additionalContext?.trim().slice(-1_000);
    const additionalContext = [prior, summary].filter(Boolean).join("\n");
    if (memory) {
      await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() })
        .where(eq(projectMemory.id, memory.id));
    } else {
      await transaction.insert(projectMemory).values({ projectId: input.projectId, userId: attempt.userId, additionalContext });
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
    if (!completedAttempt || !completedTask || !completedUsage) throw new Error("Marketing reconciliation raced with another update.");

    const statuses = tasks.map((item) => item.id === task.id ? "completed" : item.status);
    const runStatus = deriveEasyModeRunStatus(statuses);
    await transaction.update(easyModeRuns).set({
      status: runStatus,
      failedAt: null,
      ...(runStatus === "completed" ? { completedAt: now } : { completedAt: null }),
    }).where(eq(easyModeRuns.id, run.id));
    return { state: "reconciled", outputId: created.id, usageId: usage.id, nextModule: nextModule() };
  });
}
