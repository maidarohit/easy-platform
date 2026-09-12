import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, easyModeRuns, easyModeTaskAttempts, easyModeTasks } from "@/app/db/schema";
import { buildAiUsageCompletionUpdate } from "@/app/lib/ai-usage";
import { validateAiUsageMetadataCandidate, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import {
  createTrustedModuleExecutionContext,
  isEasyModeModuleId,
  type EasyModeModuleId,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { derivePersistedEasyModeRunStatus } from "@/app/lib/easy-mode-task-attempts";
import {
  persistBrandingOutputAndMemoryInTransaction,
  persistContentOutputAndMemoryInTransaction,
  persistLogoOutputAndMemoryInTransaction,
  persistTextSpecialistOutputAndMemoryInTransaction,
  type PersistedOutput,
} from "@/app/lib/easy-mode-specialist-persistence";
import { validateBrandingWebhookOutput, loadCanonicalBrandingInput } from "@/app/lib/branding-execution";
import { validateContentWebhookOutput } from "@/app/lib/content-execution";
import { validateLogoWebhookOutput } from "@/app/lib/logo-execution";
import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";
import { validateMarketingWebhookOutput } from "@/app/lib/marketing-insight-safety";
import { loadOwnedSalesContext } from "@/app/lib/sales-business-context";
import { validateSalesWebhookOutput } from "@/app/lib/sales-insight-safety";
import { validateTextSpecialistWebhookOutput, type TextSpecialistModule } from "@/app/lib/text-specialist-execution";

const MAX_ID_LENGTH = 128;
const MAX_ERROR_LENGTH = 2_000;
const CALLBACK_STATUS_SUCCESS = new Set(["completed", "success"]);
const CALLBACK_STATUS_FAILURE = new Set(["failed"]);
const OUTPUT_WRAPPER_KEYS = ["output", "result", "response", "data", "body", "json"] as const;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SpecialistProviderModule = Exclude<EasyModeModuleId, "ai-manager" | "branding-context">;
type CallbackSuccessBody = Readonly<{
  attemptId: string;
  executionKey: string;
  runId: string;
  taskId: string;
  projectId: string;
  module: SpecialistProviderModule;
  status: "completed";
  providerExecutionId?: string;
  usageComponents?: readonly AiUsageComponent[];
  outputPayload: unknown;
}>;
type CallbackFailureBody = Readonly<{
  attemptId: string;
  executionKey: string;
  runId: string;
  taskId: string;
  projectId: string;
  module: SpecialistProviderModule;
  status: "failed";
  providerExecutionId?: string;
  error?: string;
}>;
export type ValidSpecialistCallbackBody = CallbackSuccessBody | CallbackFailureBody;

type CallbackEvidence = Readonly<{
  attemptId: string;
  executionKey: string;
  runId: string;
  taskId: string;
  projectId: string;
  userId: string;
  module: SpecialistProviderModule;
  attemptStatus: string;
  taskStatus: string;
  projectOutputId: string | null;
  providerExecutionId: string | null;
  attemptStartedAt: Date;
}>;

export class SpecialistCallbackError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 400) {
    super(message);
    this.name = "SpecialistCallbackError";
    this.httpStatus = httpStatus;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

function normalizedIdentifier(value: unknown, pattern = /^[A-Za-z0-9_-]+$/): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_ID_LENGTH && pattern.test(normalized)
    ? normalized
    : null;
}

function normalizeModule(value: unknown): SpecialistProviderModule | null {
  return isEasyModeModuleId(value) && value !== "ai-manager" && value !== "branding-context"
    ? value
    : null;
}

export function specialistCallbackBaseUrl(): string | null {
  const secret = process.env.AI_MANAGER_CALLBACK_SECRET?.trim();
  if (!secret) return null;
  const configuredBase = process.env.AI_MANAGER_CALLBACK_BASE_URL?.trim() || "";
  const isProduction = process.env.NODE_ENV === "production";
  const value = (configuredBase || (!isProduction ? "http://localhost:3000" : "")).replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString().replace(/\/+$/, "");
    const isLocalHttp = url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if (!isProduction && isLocalHttp) return url.toString().replace(/\/+$/, "");
    return null;
  } catch {
    return null;
  }
}

export function specialistCallbackSecret(): string | null {
  const value = process.env.AI_MANAGER_CALLBACK_SECRET?.trim();
  return value ? value : null;
}

export function buildSpecialistCallbackUrl(attemptId: string): string | null {
  const base = specialistCallbackBaseUrl();
  return base ? `${base}/api/easy-mode/attempts/${encodeURIComponent(attemptId)}/callback` : null;
}

export function validateSpecialistCallbackBody(value: unknown, expectedAttemptId: string): ValidSpecialistCallbackBody | null {
  const attemptId = normalizedIdentifier(expectedAttemptId, /^[0-9a-f-]+$/i);
  if (!attemptId || !isRecord(value)) return null;

  const executionKey = normalizedIdentifier(value.executionKey);
  const runId = normalizedIdentifier(value.runId, /^[0-9a-f-]+$/i);
  const taskId = normalizedIdentifier(value.taskId, /^[0-9a-f-]+$/i);
  const projectId = normalizedIdentifier(value.projectId);
  const moduleId = normalizeModule(value.module);
  const providerExecutionId = value.providerExecutionId === undefined ? null : normalizedIdentifier(value.providerExecutionId);
  const normalizedStatus = typeof value.status === "string" ? value.status.trim().toLowerCase() : "";

  if (
    normalizedIdentifier(value.attemptId, /^[0-9a-f-]+$/i) !== attemptId ||
    !executionKey ||
    !runId ||
    !taskId ||
    !projectId ||
    !moduleId ||
    (!providerExecutionId && value.providerExecutionId !== undefined)
  ) {
    return null;
  }

  if (CALLBACK_STATUS_FAILURE.has(normalizedStatus)) {
    if (!exactKeys(value,
      ["attemptId", "executionKey", "runId", "taskId", "projectId", "module", "status"],
      ["providerExecutionId", "error"])) return null;
    if (value.error !== undefined && typeof value.error !== "string") return null;
    const error = typeof value.error === "string" ? value.error.trim() : "";
    if (error.length > MAX_ERROR_LENGTH) return null;
    return Object.freeze({
      attemptId,
      executionKey,
      runId,
      taskId,
      projectId,
      module: moduleId,
      status: "failed",
      ...(providerExecutionId ? { providerExecutionId } : {}),
      ...(error ? { error } : {}),
    });
  }

  if (!CALLBACK_STATUS_SUCCESS.has(normalizedStatus)) return null;
  const wrapperKeys = OUTPUT_WRAPPER_KEYS.filter((key) => Object.hasOwn(value, key));
  if (wrapperKeys.length !== 1) return null;
  const wrapperKey = wrapperKeys[0];
  if (!exactKeys(value,
    ["attemptId", "executionKey", "runId", "taskId", "projectId", "module", "status", wrapperKey],
    ["providerExecutionId", "usage"])) return null;
  const usage = value.usage === undefined ? null : validateAiUsageMetadataCandidate(value.usage);
  if (value.usage !== undefined && !usage) return null;
  return Object.freeze({
    attemptId,
    executionKey,
    runId,
    taskId,
    projectId,
    module: moduleId,
    status: "completed",
    ...(providerExecutionId ? { providerExecutionId } : {}),
    ...(usage ? { usageComponents: usage.components } : {}),
    outputPayload: value[wrapperKey],
  });
}

async function loadCallbackEvidence(attemptId: string): Promise<CallbackEvidence | null> {
  const [row] = await db.select({
    attemptId: easyModeTaskAttempts.id,
    executionKey: easyModeTaskAttempts.executionKey,
    runId: easyModeTaskAttempts.runId,
    taskId: easyModeTaskAttempts.taskId,
    projectId: easyModeTaskAttempts.projectId,
    userId: easyModeTaskAttempts.userId,
    module: easyModeTasks.moduleId,
    attemptStatus: easyModeTaskAttempts.status,
    taskStatus: easyModeTasks.status,
    projectOutputId: easyModeTasks.projectOutputId,
    providerExecutionId: easyModeTaskAttempts.providerExecutionId,
    attemptStartedAt: easyModeTaskAttempts.startedAt,
  }).from(easyModeTaskAttempts).innerJoin(easyModeTasks, eq(easyModeTasks.id, easyModeTaskAttempts.taskId))
    .where(eq(easyModeTaskAttempts.id, attemptId)).limit(1);
  const moduleId = row ? normalizeModule(row.module) : null;
  return row && moduleId ? { ...row, module: moduleId } : null;
}

async function validateCallbackOutput(
  context: TrustedModuleExecutionContext,
  module: SpecialistProviderModule,
  outputPayload: unknown,
) {
  if (module === "branding") {
    const input = await loadCanonicalBrandingInput(context);
    return validateBrandingWebhookOutput(input, outputPayload);
  }
  if (module === "content") return validateContentWebhookOutput(outputPayload);
  if (module === "logo") return validateLogoWebhookOutput(outputPayload);
  if (module === "marketing") {
    const marketingContext = await loadOwnedMarketingContext(context.userId, context.projectId);
    return marketingContext ? validateMarketingWebhookOutput(outputPayload, marketingContext) : null;
  }
  if (module === "sales") {
    const salesContext = await loadOwnedSalesContext(context.userId, context.projectId);
    return salesContext ? validateSalesWebhookOutput(outputPayload, salesContext) : null;
  }
  return validateTextSpecialistWebhookOutput(module as TextSpecialistModule, outputPayload);
}

async function persistValidatedOutput(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  module: SpecialistProviderModule,
  output: unknown,
): Promise<PersistedOutput> {
  if (module === "branding") return persistBrandingOutputAndMemoryInTransaction(transaction, context, output);
  if (module === "content") return persistContentOutputAndMemoryInTransaction(transaction, context, output);
  if (module === "logo") return persistLogoOutputAndMemoryInTransaction(transaction, context, output);
  return persistTextSpecialistOutputAndMemoryInTransaction(transaction, context, module as TextSpecialistModule, output);
}

async function refreshRunStatus(transaction: DbTransaction, runId: string) {
  const tasks = await transaction.select({
    status: easyModeTasks.status,
    projectOutputId: easyModeTasks.projectOutputId,
  }).from(easyModeTasks).where(eq(easyModeTasks.runId, runId));
  const status = derivePersistedEasyModeRunStatus(tasks);
  const now = new Date();
  await transaction.update(easyModeRuns).set({
    status,
    completedAt: status === "completed" ? now : null,
    failedAt: status === "failed" || status === "partially_completed" ? now : null,
  }).where(eq(easyModeRuns.id, runId));
  return status;
}

function logSpecialistCallbackTransition(input: Readonly<{
  evidence: CallbackEvidence;
  nextStatus: "completed" | "failed" | "ignored";
  callbackStatus: "completed" | "failed";
  providerExecutionId: string | null;
  failureCategory: string | null;
}>) {
  console.info("Easy Mode specialist callback processed.", {
    runId: input.evidence.runId,
    taskId: input.evidence.taskId,
    attemptId: input.evidence.attemptId,
    module: input.evidence.module,
    providerExecutionId: input.providerExecutionId,
    dispatchMode: "async",
    previousStatus: input.evidence.attemptStatus,
    nextStatus: input.nextStatus,
    callbackStatus: input.callbackStatus,
    elapsedMs: Math.max(0, Date.now() - input.evidence.attemptStartedAt.getTime()),
    failureCategory: input.failureCategory,
  });
}

function assertAttemptCorrelation(evidence: CallbackEvidence, body: ValidSpecialistCallbackBody) {
  if (
    evidence.executionKey !== body.executionKey ||
    evidence.runId !== body.runId ||
    evidence.taskId !== body.taskId ||
    evidence.projectId !== body.projectId ||
    evidence.module !== body.module
  ) {
    throw new SpecialistCallbackError("Callback does not match the active specialist attempt.", 409);
  }
  if (body.providerExecutionId && evidence.providerExecutionId && body.providerExecutionId !== evidence.providerExecutionId) {
    throw new SpecialistCallbackError("Callback does not match the active specialist attempt.", 409);
  }
}

export async function syncEasyModeSpecialistCallback(
  attemptId: string,
  body: ValidSpecialistCallbackBody,
): Promise<Readonly<{
  state: "completed" | "failed" | "ignored";
  continuation: Readonly<{ runId: string; userId: string }> | null;
}>> {
  const evidence = await loadCallbackEvidence(attemptId);
  if (!evidence) throw new SpecialistCallbackError("Specialist attempt not found.", 404);
  assertAttemptCorrelation(evidence, body);

  let validatedOutput: unknown = null;
  const context = createTrustedModuleExecutionContext({
    userId: evidence.userId,
    projectId: evidence.projectId,
    runId: evidence.runId,
    taskId: evidence.taskId,
  });
  if (body.status === "completed") {
    validatedOutput = await validateCallbackOutput(context, evidence.module, body.outputPayload);
    if (!validatedOutput) throw new SpecialistCallbackError("Invalid callback body.", 400);
  }

  const result = await db.transaction(async (transaction) => {
    const [attempt] = await transaction.select().from(easyModeTaskAttempts)
      .where(eq(easyModeTaskAttempts.id, attemptId)).limit(1).for("update");
    if (!attempt) throw new SpecialistCallbackError("Specialist attempt not found.", 404);
    const [task] = await transaction.select().from(easyModeTasks)
      .where(and(eq(easyModeTasks.id, attempt.taskId), eq(easyModeTasks.runId, attempt.runId))).limit(1).for("update");
    const [run] = await transaction.select().from(easyModeRuns)
      .where(and(eq(easyModeRuns.id, attempt.runId), eq(easyModeRuns.userId, attempt.userId))).limit(1).for("update");
    const [latestAttempt] = await transaction.select({ id: easyModeTaskAttempts.id })
      .from(easyModeTaskAttempts)
      .where(eq(easyModeTaskAttempts.taskId, attempt.taskId))
      .orderBy(desc(easyModeTaskAttempts.attemptNumber))
      .limit(1);
    if (!task || !run || task.moduleId !== body.module) {
      throw new SpecialistCallbackError("Callback does not match the active specialist attempt.", 409);
    }
    if (!attempt.usageId) {
      throw new SpecialistCallbackError("Callback does not match the active specialist attempt.", 409);
    }
    if (body.providerExecutionId && attempt.providerExecutionId && body.providerExecutionId !== attempt.providerExecutionId) {
      throw new SpecialistCallbackError("Callback does not match the active specialist attempt.", 409);
    }

    const currentEvidence: CallbackEvidence = {
      attemptId: attempt.id,
      executionKey: attempt.executionKey,
      runId: attempt.runId,
      taskId: attempt.taskId,
      projectId: attempt.projectId,
      userId: attempt.userId,
      module: body.module,
      attemptStatus: attempt.status,
      taskStatus: task.status,
      projectOutputId: task.projectOutputId,
      providerExecutionId: attempt.providerExecutionId,
      attemptStartedAt: attempt.startedAt,
    };

    if (attempt.status === "completed" && task.status === "completed" && task.projectOutputId) {
      logSpecialistCallbackTransition({
        evidence: currentEvidence,
        nextStatus: "ignored",
        callbackStatus: body.status,
        providerExecutionId: body.providerExecutionId ?? attempt.providerExecutionId,
        failureCategory: null,
      });
      return {
        state: "ignored" as const,
        continuation: run.status === "completed" || run.status === "failed"
          ? null
          : { runId: run.id, userId: run.userId },
      };
    }

    const canRecoverLateSuccess = body.status === "completed" &&
      attempt.status === "failed_uncertain" &&
      task.status === "failed" &&
      task.projectOutputId === null &&
      latestAttempt?.id === attempt.id;
    const isActive = attempt.status === "dispatching" || attempt.status === "running";
    if (!isActive && !canRecoverLateSuccess) {
      logSpecialistCallbackTransition({
        evidence: currentEvidence,
        nextStatus: "ignored",
        callbackStatus: body.status,
        providerExecutionId: body.providerExecutionId ?? attempt.providerExecutionId,
        failureCategory: body.status === "failed" ? "provider_failed" : null,
      });
      return { state: "ignored" as const, continuation: null };
    }

    const now = new Date();
    if (body.status === "failed") {
      await transaction.update(aiUsage).set({
        status: "failed",
        durationMs: Math.max(0, now.getTime() - attempt.startedAt.getTime()),
      }).where(eq(aiUsage.id, attempt.usageId));
      await transaction.update(easyModeTaskAttempts).set({
        status: "failed_uncertain",
        finishedAt: now,
        safeErrorCode: "TASK_FAILED",
        ...(body.providerExecutionId ? { providerExecutionId: body.providerExecutionId } : {}),
      }).where(and(
        eq(easyModeTaskAttempts.id, attempt.id),
        inArray(easyModeTaskAttempts.status, ["dispatching", "running", "failed_uncertain"]),
      ));
      await transaction.update(easyModeTasks).set({
        status: "failed",
        failedAt: now,
        completedAt: null,
        safeErrorCode: "TASK_FAILED",
      }).where(and(
        eq(easyModeTasks.id, task.id),
        inArray(easyModeTasks.status, ["running", "failed"]),
      ));
      await refreshRunStatus(transaction, run.id);
      logSpecialistCallbackTransition({
        evidence: currentEvidence,
        nextStatus: "failed",
        callbackStatus: "failed",
        providerExecutionId: body.providerExecutionId ?? attempt.providerExecutionId,
        failureCategory: "provider_failed",
      });
      return { state: "failed" as const, continuation: null };
    }

    const persisted = await persistValidatedOutput(transaction, context, body.module, validatedOutput);
    await transaction.update(aiUsage).set(buildAiUsageCompletionUpdate({
      durationMs: Math.max(0, now.getTime() - attempt.startedAt.getTime()),
      usageComponents: body.usageComponents,
    })).where(eq(aiUsage.id, attempt.usageId));
    await transaction.update(easyModeTaskAttempts).set({
      status: "completed",
      finishedAt: now,
      safeErrorCode: null,
      ...(body.providerExecutionId ? { providerExecutionId: body.providerExecutionId } : {}),
    }).where(and(
      eq(easyModeTaskAttempts.id, attempt.id),
      inArray(easyModeTaskAttempts.status, ["dispatching", "running", "failed_uncertain"]),
    ));
    await transaction.update(easyModeTasks).set({
      status: "completed",
      projectOutputId: persisted.id,
      completedAt: now,
      failedAt: null,
      safeErrorCode: null,
    }).where(and(
      eq(easyModeTasks.id, task.id),
      inArray(easyModeTasks.status, ["running", "failed"]),
      sql`${easyModeTasks.projectOutputId} is null`,
    ));
    await refreshRunStatus(transaction, run.id);
    logSpecialistCallbackTransition({
      evidence: currentEvidence,
      nextStatus: "completed",
      callbackStatus: "completed",
      providerExecutionId: body.providerExecutionId ?? attempt.providerExecutionId,
      failureCategory: null,
    });
    return {
      state: "completed" as const,
      continuation: { runId: run.id, userId: run.userId },
    };
  });

  return result;
}
