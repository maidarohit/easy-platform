import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, easyModeRuns, easyModeTaskAttempts, easyModeTasks } from "@/app/db/schema";
import { buildAiUsageCompletionUpdate } from "@/app/lib/ai-usage";
import type { AiUsageMetadata, AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import {
  createTrustedModuleExecutionContext,
  detectModuleOutputFailureField,
  getModuleAdapter,
  type EasyModeModuleId,
  type NormalizedModuleOutput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import {
  buildAttemptRecoveryState,
  hasReplayableSavedResponse,
  isAutoRetryableFailureCategory,
  safeRecoveryPayload,
  type EasyModeAttemptRecoveryState,
  type EasyModeFailureCategory,
  type EasyModeValidationStage,
} from "@/app/lib/easy-mode-recovery-state";
import { buildEasyModeRunStatusLeaseUpdate } from "@/app/lib/easy-mode-task-attempts";
import {
  persistBrandingOutputAndMemoryInTransaction,
  persistContentOutputAndMemoryInTransaction,
  persistLogoOutputAndMemoryInTransaction,
  persistTextSpecialistOutputAndMemoryInTransaction,
  type PersistedOutput,
} from "@/app/lib/easy-mode-specialist-persistence";
import { derivePersistedEasyModeRunStatus, loadOwnedEasyModeAttemptRecoveryState } from "@/app/lib/easy-mode-task-attempts";
import {
  finalizeSanitizedBrandingOutput,
  loadCanonicalBrandingInput,
  normalizeBrandingProviderCandidate,
  validateBrandingWebhookOutput,
} from "@/app/lib/branding-execution";
import { sanitizeBrandingOutput } from "@/app/lib/branding-insight-safety";
import { validateContentWebhookOutput } from "@/app/lib/content-execution";
import { validateLogoWebhookOutput } from "@/app/lib/logo-execution";
import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";
import { sanitizeMarketingInsights, validateMarketingWebhookOutput } from "@/app/lib/marketing-insight-safety";
import { loadOwnedSalesContext } from "@/app/lib/sales-business-context";
import { sanitizeSalesInsights, validateSalesWebhookOutput } from "@/app/lib/sales-insight-safety";
import {
  buildCanonicalSeoOutput,
  nonEmptySeoSignalCount,
  recognizedSeoRecord,
  validateSeoWebhookOutput,
} from "@/app/lib/seo-webhook-validation";
import { validateAnalyticsWebhookOutput } from "@/app/lib/analytics-insight-safety";
import { unwrapMarketingProviderResponse } from "@/app/lib/marketing-provider-response";
import { unwrapSalesProviderResponse } from "@/app/lib/sales-provider-response";
import {
  repairRequiredUiuxFields,
  sanitizeUiuxOutput,
  validateUiuxWebhookOutput,
} from "@/app/lib/uiux-insight-safety";
import { loadOwnedUiuxContext } from "@/app/lib/uiux-business-context";
import { unwrapSingleWebhookCandidate } from "@/app/lib/specialist-execution";
import { validateMarketingOutput, validateSalesOutput, validateSeoOutput, validateUiuxOutput } from "@/app/lib/easy-mode-execution-contracts";

type RecoveryAttempt = Awaited<ReturnType<typeof loadOwnedEasyModeAttemptRecoveryState>>;
type ProviderReplayModule = Exclude<EasyModeModuleId, "ai-manager" | "branding-context">;
type ReplayResolution =
  | Readonly<{
      ok: true;
      output: NormalizedModuleOutput;
      normalizedResponse: Record<string, unknown>;
      validationStage: "final_contract";
    }>
  | Readonly<{
      ok: false;
      failureCategory: EasyModeFailureCategory;
      validationStage: EasyModeValidationStage;
      failedField: string | null;
      normalizedResponse: Record<string, unknown> | null;
    }>;

export type ReplaySavedResponseResult = Readonly<{
  state: "completed" | "ignored" | "not_replayable" | "failed_closed" | "not_found";
  canAutoRetry: boolean;
  failureCategory: EasyModeFailureCategory | null;
  validationStage: EasyModeValidationStage | null;
  failedField: string | null;
  projectOutputId?: string;
  continuation?: Readonly<{ runId: string; userId: string }> | null;
}>;

type ReplayDependencies = Readonly<{
  loadAttempt: typeof loadOwnedEasyModeAttemptRecoveryState;
  resolveSavedResponse: (attempt: NonNullable<RecoveryAttempt>) => Promise<ReplayResolution>;
  saveFailureState: (attempt: NonNullable<RecoveryAttempt>, recoveryState: EasyModeAttemptRecoveryState) => Promise<void>;
  commitReplay: (attempt: NonNullable<RecoveryAttempt>, resolved: Extract<ReplayResolution, { ok: true }>) => Promise<Readonly<{
    state: "completed" | "ignored";
    projectOutputId?: string;
    continuation: Readonly<{ runId: string; userId: string }> | null;
  }>>;
}>;

const defaultDependencies: ReplayDependencies = {
  loadAttempt: loadOwnedEasyModeAttemptRecoveryState,
  resolveSavedResponse: (attempt) => resolveSavedEasyModeProviderResponse(attempt),
  saveFailureState: async (attempt, recoveryState) => {
    await db.update(easyModeTaskAttempts).set({ recoveryState }).where(and(
      eq(easyModeTaskAttempts.id, attempt.id),
      eq(easyModeTaskAttempts.userId, attempt.userId),
    ));
  },
  commitReplay: async (attempt, resolved) => db.transaction(async (transaction) => {
    const [lockedAttempt] = await transaction.select().from(easyModeTaskAttempts)
      .where(and(eq(easyModeTaskAttempts.id, attempt.id), eq(easyModeTaskAttempts.userId, attempt.userId)))
      .limit(1).for("update");
    const [task] = await transaction.select().from(easyModeTasks)
      .where(and(eq(easyModeTasks.id, attempt.taskId), eq(easyModeTasks.runId, attempt.runId)))
      .limit(1).for("update");
    const [run] = await transaction.select().from(easyModeRuns)
      .where(and(eq(easyModeRuns.id, attempt.runId), eq(easyModeRuns.userId, attempt.userId)))
      .limit(1).for("update");
    const [latestAttempt] = await transaction.select({ id: easyModeTaskAttempts.id })
      .from(easyModeTaskAttempts)
      .where(eq(easyModeTaskAttempts.taskId, attempt.taskId))
      .orderBy(desc(easyModeTaskAttempts.attemptNumber))
      .limit(1);
    if (!lockedAttempt || !task || !run || latestAttempt?.id !== lockedAttempt.id) {
      return { state: "ignored" as const, projectOutputId: task?.projectOutputId ?? undefined, continuation: null };
    }
    if (task.status === "completed" && task.projectOutputId) {
      return {
        state: "ignored" as const,
        projectOutputId: task.projectOutputId,
        continuation: run.status === "completed" || run.status === "failed" ? null : { runId: run.id, userId: run.userId },
      };
    }
    const replayState = buildAttemptRecoveryState({
      projectId: attempt.projectId,
      runId: attempt.runId,
      taskId: attempt.taskId,
      attemptId: attempt.id,
      module: attempt.moduleId,
      providerStatus: attempt.recoveryState?.providerStatus ?? null,
      rawProviderResponse: attempt.recoveryState?.rawProviderResponse ?? null,
      normalizedResponse: resolved.normalizedResponse,
      usage: attempt.recoveryState?.usage ?? null,
      failureCategory: null,
      failurePoint: null,
      validationStage: "final_contract",
      failedField: null,
    });
    const context = createTrustedModuleExecutionContext({
      userId: attempt.userId,
      projectId: attempt.projectId,
      runId: attempt.runId,
      taskId: attempt.taskId,
    });
    await transaction.update(easyModeTaskAttempts).set({ recoveryState: replayState }).where(eq(easyModeTaskAttempts.id, lockedAttempt.id));
    const persisted = await persistedModuleTransaction(transaction, context, attempt.moduleId as ProviderReplayModule, resolved.output);
    if (lockedAttempt.usageId) {
      await transaction.update(aiUsage).set(buildAiUsageCompletionUpdate({
        durationMs: Math.max(0, Date.now() - lockedAttempt.startedAt.getTime()),
        usageComponents: replayState.usage?.components,
      })).where(and(
        eq(aiUsage.id, lockedAttempt.usageId),
        eq(aiUsage.userId, attempt.userId),
        eq(aiUsage.projectId, attempt.projectId),
        inArray(aiUsage.status, ["started", "failed", "success"]),
      ));
    }
    const now = new Date();
    await transaction.update(easyModeTaskAttempts).set({
      status: "completed",
      finishedAt: now,
      safeErrorCode: null,
      recoveryState: replayState,
    }).where(eq(easyModeTaskAttempts.id, lockedAttempt.id));
    await transaction.update(easyModeTasks).set({
      status: "completed",
      projectOutputId: persisted.id,
      completedAt: now,
      failedAt: null,
      safeErrorCode: null,
    }).where(and(
      eq(easyModeTasks.id, task.id),
      inArray(easyModeTasks.status, ["running", "failed", "queued"]),
    ));
    await refreshRunStatus(transaction, run.id);
    return {
      state: "completed" as const,
      projectOutputId: persisted.id,
      continuation: { runId: run.id, userId: run.userId },
    };
  }),
};

function normalizedUsage(components: readonly AiUsageComponent[] | null | undefined): AiUsageMetadata | null {
  return components && components.length > 0 ? { version: 1, components: [...components] } : null;
}

function mapFailureCategory(
  category: string | null | undefined,
  providerStatus: number | null,
): EasyModeFailureCategory {
  if (category === "empty_response") return "empty_response";
  if (category === "invalid_json") return "invalid_json";
  if (category === "schema_validation_failure") return "schema_validation_failure";
  if (category === "timeout") return "provider_timeout";
  if (category === "fetch_network_error") return "safe_network_error";
  if (category === "upstream_non_2xx") {
    return typeof providerStatus === "number" && providerStatus >= 500 ? "temporary_upstream_5xx" : "upstream_http_error";
  }
  return "unknown";
}

function toRecord(value: NormalizedModuleOutput): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function contractFailure(module: ProviderReplayModule, value: unknown) {
  return detectModuleOutputFailureField(module, value) ?? null;
}

async function resolveBranding(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const input = await loadCanonicalBrandingInput(context);
  const unwrapped = unwrapSingleWebhookCandidate(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const brandingValidator = getModuleAdapter("branding")?.validateOutput;
  const initial = brandingValidator?.(unwrapped) ?? brandingValidator?.(normalizeBrandingProviderCandidate(unwrapped));
  if (!initial) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("branding", normalizeBrandingProviderCandidate(unwrapped)),
      normalizedResponse: null,
    };
  }
  const sanitized = sanitizeBrandingOutput(initial, input);
  if (!sanitized) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "sanitize", failedField: null, normalizedResponse: toRecord(initial) };
  }
  const repaired = finalizeSanitizedBrandingOutput(input, sanitized as Record<string, string>);
  if (!repaired) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "final_contract", failedField: contractFailure("branding", sanitized), normalizedResponse: safeRecoveryPayload(sanitized) as Record<string, unknown> | null };
  }
  const shared = validateBrandingWebhookOutput(input, payload);
  if (!shared) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "final_contract", failedField: contractFailure("branding", repaired), normalizedResponse: toRecord(repaired) };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveWebsite(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const unwrapped = unwrapSingleWebhookCandidate(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const initial = getModuleAdapter("website")?.validateOutput?.(unwrapped);
  if (!initial) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("website", unwrapped),
      normalizedResponse: null,
    };
  }
  const shared = getModuleAdapter("website")?.validateOutput?.(initial);
  if (!shared) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "final_contract",
      failedField: contractFailure("website", initial),
      normalizedResponse: toRecord(initial),
    };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveMarketing(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const marketingContext = await loadOwnedMarketingContext(context.userId, context.projectId);
  if (!marketingContext) {
    return { ok: false, failureCategory: "ownership_failure", validationStage: "initial_contract", failedField: null, normalizedResponse: null };
  }
  const unwrapped = unwrapMarketingProviderResponse(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const initial = validateMarketingOutput(unwrapped);
  if (!initial) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("marketing", unwrapped),
      normalizedResponse: null,
    };
  }
  const sanitized = sanitizeMarketingInsights(initial, marketingContext);
  if (!sanitized) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "sanitize", failedField: null, normalizedResponse: toRecord(initial) };
  }
  const shared = validateMarketingWebhookOutput(payload, marketingContext);
  if (!shared) {
    const final = validateMarketingOutput(sanitized);
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: final ? "final_contract" : "sanitize",
      failedField: final ? contractFailure("marketing", final) : contractFailure("marketing", sanitized),
      normalizedResponse: safeRecoveryPayload(sanitized) as Record<string, unknown> | null,
    };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveSeo(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const seoContext = await loadOwnedMarketingContext(context.userId, context.projectId);
  if (!seoContext) {
    return { ok: false, failureCategory: "ownership_failure", validationStage: "initial_contract", failedField: null, normalizedResponse: null };
  }
  const unwrapped = unwrapSingleWebhookCandidate(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const canonical = validateSeoOutput(unwrapped);
  const recognized = recognizedSeoRecord(unwrapped);
  if (!canonical && (!recognized || nonEmptySeoSignalCount(recognized) < 3)) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("seo", recognized ?? unwrapped),
      normalizedResponse: null,
    };
  }
  const repaired = buildCanonicalSeoOutput((canonical ?? recognized) as Record<string, unknown>, seoContext);
  if (!repaired) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "repair",
      failedField: null,
      normalizedResponse: canonical ? toRecord(canonical) : (safeRecoveryPayload(recognized) as Record<string, unknown> | null),
    };
  }
  const shared = validateSeoWebhookOutput(payload, seoContext);
  if (!shared) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "final_contract",
      failedField: contractFailure("seo", repaired),
      normalizedResponse: toRecord(repaired),
    };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveUiux(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const uiuxContext = await loadOwnedUiuxContext(context.userId, context.projectId);
  if (!uiuxContext) {
    return { ok: false, failureCategory: "ownership_failure", validationStage: "initial_contract", failedField: null, normalizedResponse: null };
  }
  const unwrapped = unwrapSingleWebhookCandidate(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const initial = validateUiuxOutput(unwrapped);
  if (!initial) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("uiux", unwrapped),
      normalizedResponse: null,
    };
  }
  const sanitized = sanitizeUiuxOutput(initial, uiuxContext);
  if (!sanitized) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "sanitize", failedField: null, normalizedResponse: toRecord(initial) };
  }
  const repaired = repairRequiredUiuxFields(sanitized, uiuxContext);
  const shared = validateUiuxWebhookOutput(payload, uiuxContext);
  if (!shared) {
    const final = validateUiuxOutput(repaired);
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: final ? "final_contract" : "repair",
      failedField: contractFailure("uiux", repaired),
      normalizedResponse: safeRecoveryPayload(repaired) as Record<string, unknown> | null,
    };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveSales(context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const salesContext = await loadOwnedSalesContext(context.userId, context.projectId);
  if (!salesContext) {
    return { ok: false, failureCategory: "ownership_failure", validationStage: "initial_contract", failedField: null, normalizedResponse: null };
  }
  const unwrapped = unwrapSalesProviderResponse(payload);
  if (!unwrapped) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "unwrap", failedField: null, normalizedResponse: null };
  }
  const initial = validateSalesOutput(unwrapped);
  if (!initial) {
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "initial_contract",
      failedField: contractFailure("sales", unwrapped),
      normalizedResponse: null,
    };
  }
  const sanitized = sanitizeSalesInsights(initial, salesContext);
  if (!sanitized) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "sanitize", failedField: null, normalizedResponse: toRecord(initial) };
  }
  const shared = validateSalesWebhookOutput(payload, salesContext);
  if (!shared) {
    const final = validateSalesOutput(sanitized);
    return {
      ok: false,
      failureCategory: "schema_validation_failure",
      validationStage: "final_contract",
      failedField: contractFailure("sales", final ?? sanitized),
      normalizedResponse: safeRecoveryPayload(sanitized) as Record<string, unknown> | null,
    };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveAnalytics(_context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const shared = validateAnalyticsWebhookOutput(payload);
  if (!shared) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "final_contract", failedField: contractFailure("analytics", unwrapSingleWebhookCandidate(payload)), normalizedResponse: null };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveLogo(_context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const shared = validateLogoWebhookOutput(payload);
  if (!shared) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "final_contract", failedField: contractFailure("logo", unwrapSingleWebhookCandidate(payload)), normalizedResponse: null };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

async function resolveContent(_context: TrustedModuleExecutionContext, payload: unknown): Promise<ReplayResolution> {
  const shared = validateContentWebhookOutput(payload);
  if (!shared) {
    return { ok: false, failureCategory: "schema_validation_failure", validationStage: "final_contract", failedField: contractFailure("content", unwrapSingleWebhookCandidate(payload)), normalizedResponse: null };
  }
  return { ok: true, output: shared, normalizedResponse: toRecord(shared), validationStage: "final_contract" };
}

export async function resolveSavedEasyModeProviderResponse(attempt: NonNullable<RecoveryAttempt>): Promise<ReplayResolution> {
  const moduleId = attempt.moduleId as ProviderReplayModule;
  const state = attempt.recoveryState;
  if (!state || !hasReplayableSavedResponse(state)) {
    return { ok: false, failureCategory: "malformed_saved_response", validationStage: "provider_response", failedField: null, normalizedResponse: null };
  }
  const payload = state.rawProviderResponse ?? state.normalizedResponse;
  if (safeRecoveryPayload(payload) === null) {
    return { ok: false, failureCategory: "unsafe_saved_response", validationStage: "provider_response", failedField: null, normalizedResponse: null };
  }
  const context = createTrustedModuleExecutionContext({
    userId: attempt.userId,
    projectId: attempt.projectId,
    runId: attempt.runId,
    taskId: attempt.taskId,
  });
  if (moduleId === "branding") return resolveBranding(context, payload);
  if (moduleId === "website") return resolveWebsite(context, payload);
  if (moduleId === "marketing") return resolveMarketing(context, payload);
  if (moduleId === "seo") return resolveSeo(context, payload);
  if (moduleId === "uiux") return resolveUiux(context, payload);
  if (moduleId === "sales") return resolveSales(context, payload);
  if (moduleId === "analytics") return resolveAnalytics(context, payload);
  if (moduleId === "logo") return resolveLogo(context, payload);
  return resolveContent(context, payload);
}

function persistedModuleTransaction(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: TrustedModuleExecutionContext,
  module: ProviderReplayModule,
  output: NormalizedModuleOutput,
): Promise<PersistedOutput> {
  if (module === "branding") return persistBrandingOutputAndMemoryInTransaction(transaction, context, output);
  if (module === "content") return persistContentOutputAndMemoryInTransaction(transaction, context, output);
  if (module === "logo") return persistLogoOutputAndMemoryInTransaction(transaction, context, output);
  return persistTextSpecialistOutputAndMemoryInTransaction(transaction, context, module, output);
}

async function refreshRunStatus(transaction: Parameters<Parameters<typeof db.transaction>[0]>[0], runId: string) {
  const tasks = await transaction.select({
    status: easyModeTasks.status,
    projectOutputId: easyModeTasks.projectOutputId,
  }).from(easyModeTasks).where(eq(easyModeTasks.runId, runId));
  const status = derivePersistedEasyModeRunStatus(tasks);
  await transaction.update(easyModeRuns).set(buildEasyModeRunStatusLeaseUpdate(status, new Date()))
    .where(eq(easyModeRuns.id, runId));
  return status;
}

export async function replaySavedEasyModeProviderResponse(
  input: Readonly<{ attemptId: string; userId: string }>,
  overrides: Partial<ReplayDependencies> = {},
): Promise<ReplaySavedResponseResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const attempt = await dependencies.loadAttempt(input);
  if (!attempt) {
    return {
      state: "not_found",
      canAutoRetry: false,
      failureCategory: "ownership_failure",
      validationStage: null,
      failedField: null,
    };
  }
  const savedState = attempt.recoveryState;
  if (!savedState || !hasReplayableSavedResponse(savedState)) {
    return {
      state: "not_replayable",
      canAutoRetry: isAutoRetryableFailureCategory(savedState?.failureCategory ?? null),
      failureCategory: savedState?.failureCategory ?? null,
      validationStage: savedState?.validationStage ?? null,
      failedField: savedState?.failedField ?? null,
    };
  }
  if (attempt.taskStatus === "completed" && attempt.taskProjectOutputId) {
    return {
      state: "ignored",
      canAutoRetry: false,
      failureCategory: "completed_task",
      validationStage: null,
      failedField: null,
      projectOutputId: attempt.taskProjectOutputId,
      continuation: attempt.runStatus === "completed" || attempt.runStatus === "failed" ? null : { runId: attempt.runId, userId: attempt.userId },
    };
  }

  const resolved = await dependencies.resolveSavedResponse(attempt);
  if (!resolved.ok) {
    const failedState = buildAttemptRecoveryState({
      projectId: attempt.projectId,
      runId: attempt.runId,
      taskId: attempt.taskId,
      attemptId: attempt.id,
      module: attempt.moduleId,
      providerStatus: savedState.providerStatus,
      rawProviderResponse: savedState.rawProviderResponse,
      normalizedResponse: resolved.normalizedResponse,
      usage: savedState.usage,
      failureCategory: resolved.failureCategory,
      failurePoint: attempt.status === "failed_uncertain" ? "uncertain" : "before_dispatch",
      validationStage: resolved.validationStage,
      failedField: resolved.failedField,
    });
    await dependencies.saveFailureState(attempt, failedState);
    return {
      state: "failed_closed",
      canAutoRetry: isAutoRetryableFailureCategory(resolved.failureCategory),
      failureCategory: resolved.failureCategory,
      validationStage: resolved.validationStage,
      failedField: resolved.failedField,
    };
  }

  try {
    const committed = await dependencies.commitReplay(attempt, resolved);
    return {
      state: committed.state,
      canAutoRetry: false,
      failureCategory: null,
      validationStage: committed.state === "completed" ? "final_contract" : null,
      failedField: null,
      projectOutputId: committed.projectOutputId,
      continuation: committed.continuation,
    };
  } catch {
    const failedState = buildAttemptRecoveryState({
      projectId: attempt.projectId,
      runId: attempt.runId,
      taskId: attempt.taskId,
      attemptId: attempt.id,
      module: attempt.moduleId,
      providerStatus: savedState.providerStatus,
      rawProviderResponse: savedState.rawProviderResponse,
      normalizedResponse: resolved.normalizedResponse,
      usage: savedState.usage,
      failureCategory: "persistence_failure",
      failurePoint: attempt.status === "failed_uncertain" ? "uncertain" : "before_dispatch",
      validationStage: "persistence",
      failedField: null,
    });
    await dependencies.saveFailureState(attempt, failedState);
    return {
      state: "failed_closed",
      canAutoRetry: false,
      failureCategory: "persistence_failure",
      validationStage: "persistence",
      failedField: null,
    };
  }
}

export function buildAttemptRecoveryFromExecution(input: Readonly<{
  projectId: string;
  runId: string;
  taskId: string;
  attemptId: string;
  module: string;
  providerStatus?: number | null;
  rawProviderResponse?: unknown;
  normalizedResponse?: Record<string, unknown> | null;
  usageComponents?: readonly AiUsageComponent[] | null;
  failureCategory?: string | null;
  failurePoint?: "before_dispatch" | "uncertain" | null;
  validationStage?: EasyModeValidationStage | null;
  failedField?: string | null;
}>): EasyModeAttemptRecoveryState {
  return buildAttemptRecoveryState({
    projectId: input.projectId,
    runId: input.runId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    module: input.module,
    providerStatus: input.providerStatus ?? null,
    rawProviderResponse: input.rawProviderResponse,
    normalizedResponse: input.normalizedResponse ?? null,
    usage: normalizedUsage(input.usageComponents),
    failureCategory: mapFailureCategory(input.failureCategory, input.providerStatus ?? null),
    failurePoint: input.failurePoint ?? null,
    validationStage: input.validationStage ?? null,
    failedField: input.failedField ?? null,
  });
}

export function failureCategoryFromRecoveryState(state: EasyModeAttemptRecoveryState | null): EasyModeFailureCategory | null {
  return state?.failureCategory ?? null;
}
