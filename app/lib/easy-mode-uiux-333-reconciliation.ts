import "server-only";

import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
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

export const UIUX_333_PROJECT_ID = "ad98e057-4fe9-4394-97bc-05391efb85d3";
export const UIUX_333_PROVIDER_EXECUTION_ID = "333";
const UIUX_333_DURATION_MS = 41_435;
const BUILD_KEY_PREFIX = "business-dna-build:%";
const UIUX_333_RECOVERABLE_ATTEMPT_STATUSES = ["dispatching", "running"] as const;

export function isUiux333RecoverableAttemptStatus(status: string): boolean {
  return UIUX_333_RECOVERABLE_ATTEMPT_STATUSES.includes(
    status as (typeof UIUX_333_RECOVERABLE_ATTEMPT_STATUSES)[number],
  );
}

export type Uiux333ReconciliationInput = Readonly<{
  projectId: string;
  executionId: string;
  response: unknown;
  dryRun: boolean;
}>;

export type Uiux333ReconciliationResult = Readonly<{
  state: "validated" | "reconciled" | "already_reconciled";
  runId: string;
  taskId: string;
  attemptId: string;
  usageId: string;
  outputId: string | null;
  salesStatus: "queued";
}>;

type ReconciliationWriter = (
  output: Readonly<Record<string, string>>,
  dryRun: boolean,
) => Promise<Uiux333ReconciliationResult>;

export async function reconcileEasyModeUiux333(
  input: Uiux333ReconciliationInput,
  writer: ReconciliationWriter = persistUiux333Reconciliation,
) {
  if (input.projectId !== UIUX_333_PROJECT_ID || input.executionId !== UIUX_333_PROVIDER_EXECUTION_ID) {
    throw new Error("Invalid reconciliation identifiers.");
  }
  const item = Array.isArray(input.response) && input.response.length === 1 ? input.response[0] : input.response;
  const output = validateUiuxOutput(item);
  if (!output) throw new Error("UIUX execution 333 result does not satisfy the production contract.");
  return writer(output, input.dryRun);
}

async function persistUiux333Reconciliation(
  output: Readonly<Record<string, string>>,
  dryRun: boolean,
): Promise<Uiux333ReconciliationResult> {
  return db.transaction(async (transaction) => {
    const [run] = await transaction.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.projectId, UIUX_333_PROJECT_ID),
      like(easyModeRuns.idempotencyKey, BUILD_KEY_PREFIX),
    )).orderBy(desc(easyModeRuns.createdAt)).limit(1).for("update");
    if (!run) throw new Error("Build run does not match UIUX execution 333.");
    if (run.status !== "running") throw new Error("Build run is not in the recoverable state.");

    const [task] = await transaction.select().from(easyModeTasks).where(and(
      eq(easyModeTasks.runId, run.id), eq(easyModeTasks.moduleId, "uiux"),
    )).limit(1).for("update");
    if (!task) throw new Error("UIUX task does not match execution 333.");

    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
      eq(easyModeTaskAttempts.runId, run.id),
      eq(easyModeTaskAttempts.taskId, task.id),
      eq(easyModeTaskAttempts.projectId, UIUX_333_PROJECT_ID),
    )).orderBy(desc(easyModeTaskAttempts.attemptNumber)).limit(1).for("update");
    if (!attempt || !attempt.usageId ||
        (attempt.providerExecutionId && attempt.providerExecutionId !== UIUX_333_PROVIDER_EXECUTION_ID)) {
      throw new Error("UIUX attempt does not match execution 333.");
    }

    const [sales] = await transaction.select().from(easyModeTasks).where(and(
      eq(easyModeTasks.runId, run.id), eq(easyModeTasks.moduleId, "sales"),
    )).limit(1).for("update");
    if (!sales || sales.status !== "queued") throw new Error("Sales is not safely queued.");

    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, UIUX_333_PROJECT_ID), eq(projects.userId, attempt.userId),
    )).limit(1).for("update");
    if (!project || run.userId !== attempt.userId) throw new Error("Project ownership does not match the build.");

    const [usage] = await transaction.select().from(aiUsage).where(and(
      eq(aiUsage.id, attempt.usageId), eq(aiUsage.userId, attempt.userId),
      eq(aiUsage.projectId, UIUX_333_PROJECT_ID), eq(aiUsage.module, "uiux"),
    )).limit(1).for("update");
    if (!usage) throw new Error("Existing UIUX usage does not match execution 333.");

    if (attempt.status === "completed" && task.status === "completed" && task.projectOutputId) {
      const [existing] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.id, task.projectOutputId), eq(projectOutputs.projectId, UIUX_333_PROJECT_ID),
        eq(projectOutputs.userId, attempt.userId), eq(projectOutputs.module, "uiux"),
      )).limit(1).for("update");
      let parsed: unknown;
      try { parsed = JSON.parse(existing?.result ?? ""); } catch { parsed = null; }
      if (!existing || !validateUiuxOutput(parsed) || usage.status !== "success") {
        throw new Error("Completed UIUX reconciliation is inconsistent.");
      }
      return {
        state: "already_reconciled", runId: run.id, taskId: task.id, attemptId: attempt.id,
        usageId: usage.id, outputId: existing.id, salesStatus: "queued",
      };
    }

    if (task.status !== "running" || task.projectOutputId ||
        !isUiux333RecoverableAttemptStatus(attempt.status) || usage.status !== "started") {
      throw new Error("UIUX execution 333 is not in the recoverable state.");
    }
    const [existingUiuxOutput] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, UIUX_333_PROJECT_ID), eq(projectOutputs.userId, attempt.userId),
      eq(projectOutputs.module, "uiux"),
    )).limit(1).for("update");
    if (existingUiuxOutput) throw new Error("An unlinked UIUX output already exists.");

    if (dryRun) {
      return {
        state: "validated", runId: run.id, taskId: task.id, attemptId: attempt.id,
        usageId: usage.id, outputId: null, salesStatus: "queued",
      };
    }

    const [created] = await transaction.insert(projectOutputs).values({
      projectId: UIUX_333_PROJECT_ID, userId: attempt.userId, module: "uiux",
      result: JSON.stringify(output), approvedAt: null,
    }).returning({ id: projectOutputs.id });
    if (!created) throw new Error("UIUX output persistence failed.");

    const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
      .from(projectMemory).where(and(
        eq(projectMemory.projectId, UIUX_333_PROJECT_ID), eq(projectMemory.userId, attempt.userId),
      )).limit(1).for("update");
    const prior = memory?.additionalContext?.trim().slice(-1_000);
    const additionalContext = [prior, `Customer experience: ${output.uiuxStrategy.slice(0, 750)}`]
      .filter(Boolean).join("\n");
    if (memory) {
      await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() })
        .where(eq(projectMemory.id, memory.id));
    } else {
      await transaction.insert(projectMemory).values({
        projectId: UIUX_333_PROJECT_ID, userId: attempt.userId, additionalContext,
      });
    }

    const now = new Date();
    const [completedUsage] = await transaction.update(aiUsage).set({
      status: "success", durationMs: UIUX_333_DURATION_MS,
    }).where(and(eq(aiUsage.id, usage.id), eq(aiUsage.status, "started"))).returning({ id: aiUsage.id });
    const [completedAttempt] = await transaction.update(easyModeTaskAttempts).set({
      status: "completed", providerExecutionId: UIUX_333_PROVIDER_EXECUTION_ID,
      finishedAt: now, safeErrorCode: null,
    }).where(and(
      eq(easyModeTaskAttempts.id, attempt.id),
      inArray(easyModeTaskAttempts.status, [...UIUX_333_RECOVERABLE_ATTEMPT_STATUSES]),
    )).returning({ id: easyModeTaskAttempts.id });
    const [completedTask] = await transaction.update(easyModeTasks).set({
      status: "completed", projectOutputId: created.id, completedAt: now, failedAt: null, safeErrorCode: null,
    }).where(and(
      eq(easyModeTasks.id, task.id), eq(easyModeTasks.status, "running"),
    )).returning({ id: easyModeTasks.id });
    if (!completedUsage || !completedAttempt || !completedTask) {
      throw new Error("UIUX reconciliation raced with another transition.");
    }

    const tasks = await transaction.select({ status: easyModeTasks.status }).from(easyModeTasks)
      .where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
    const runStatus = deriveEasyModeRunStatus(tasks.map((item) => item.status));
    await transaction.update(easyModeRuns).set({
      status: runStatus, completedAt: runStatus === "completed" ? now : null,
      failedAt: runStatus === "failed" || runStatus === "partially_completed" ? now : null,
    }).where(and(eq(easyModeRuns.id, run.id), eq(easyModeRuns.projectId, UIUX_333_PROJECT_ID)));

    const [salesAfter] = await transaction.select({ status: easyModeTasks.status }).from(easyModeTasks).where(and(
      eq(easyModeTasks.id, sales.id), eq(easyModeTasks.runId, run.id),
    )).limit(1);
    if (salesAfter?.status !== "queued") throw new Error("Sales changed during UIUX reconciliation.");

    return {
      state: "reconciled", runId: run.id, taskId: task.id, attemptId: attempt.id,
      usageId: usage.id, outputId: created.id, salesStatus: "queued",
    };
  });
}
