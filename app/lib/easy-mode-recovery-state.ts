import "server-only";

import type { AiUsageMetadata } from "@/app/lib/ai-usage-metadata";

export const EASY_MODE_VALIDATION_STAGES = [
  "provider_response",
  "unwrap",
  "initial_contract",
  "sanitize",
  "repair",
  "final_contract",
  "persistence",
] as const;

export type EasyModeValidationStage = (typeof EASY_MODE_VALIDATION_STAGES)[number];

export type EasyModeFailureCategory =
  | "empty_response"
  | "invalid_json"
  | "provider_timeout"
  | "safe_network_error"
  | "temporary_upstream_5xx"
  | "upstream_http_error"
  | "schema_validation_failure"
  | "persistence_failure"
  | "malformed_saved_response"
  | "unsafe_saved_response"
  | "ownership_failure"
  | "completed_task"
  | "unknown";

export type EasyModeAttemptRecoveryState = Readonly<{
  version: 1;
  projectId: string;
  runId: string;
  taskId: string;
  attemptId: string;
  module: string;
  providerStatus: number | null;
  rawProviderResponse: unknown | null;
  normalizedResponse: Record<string, unknown> | null;
  usage: AiUsageMetadata | null;
  failureCategory: EasyModeFailureCategory | null;
  failurePoint: "before_dispatch" | "uncertain" | null;
  validationStage: EasyModeValidationStage | null;
  failedField: string | null;
  timestamp: string;
}>;

const MAX_STRING_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024;
const SECRET_KEY = /(authorization|cookie|password|api[_-]?key|firebase.*token|id[_-]?token|access[_-]?token|refresh[_-]?token|secret)/i;
const SECRET_VALUE = /\b(?:bearer\s+[a-z0-9._=-]+|AIza[0-9A-Za-z_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+)\b/i;
const SECRET_TEXT_FRAGMENT = /\b(?:authorization|x-api-key|api[_-]?key|firebase[_\s-]*token|id[_-]?token|access[_-]?token|refresh[_-]?token|set-cookie|cookie|password)\b/i;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sanitizeString(value: string): unknown | null {
  if (Buffer.byteLength(value, "utf8") > MAX_STRING_BYTES) return null;
  if (SECRET_VALUE.test(value) || SECRET_TEXT_FRAGMENT.test(value)) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return sanitizeValue(JSON.parse(trimmed));
    } catch {
      return value;
    }
  }
  return value;
}

function sanitizeValue(value: unknown): unknown | null {
  if (value == null) return null;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizeValue(item)).filter((item) => item !== null);
    return sanitized;
  }
  if (!isPlainRecord(value)) return null;
  const sanitizedEntries = Object.entries(value)
    .filter(([key]) => !SECRET_KEY.test(key))
    .map(([key, nested]) => [key, sanitizeValue(nested)] as const)
    .filter(([, nested]) => nested !== null);
  return Object.fromEntries(sanitizedEntries);
}

function boundedPayload(value: unknown): unknown | null {
  const sanitized = sanitizeValue(value);
  if (sanitized === null) return null;
  try {
    return Buffer.byteLength(JSON.stringify(sanitized), "utf8") <= MAX_TOTAL_BYTES ? sanitized : null;
  } catch {
    return null;
  }
}

export function safeRecoveryPayload(value: unknown): unknown | null {
  return boundedPayload(value);
}

export function buildAttemptRecoveryState(input: Readonly<{
  projectId: string;
  runId: string;
  taskId: string;
  attemptId: string;
  module: string;
  providerStatus?: number | null;
  rawProviderResponse?: unknown;
  normalizedResponse?: Record<string, unknown> | null;
  usage?: AiUsageMetadata | null;
  failureCategory?: EasyModeFailureCategory | null;
  failurePoint?: "before_dispatch" | "uncertain" | null;
  validationStage?: EasyModeValidationStage | null;
  failedField?: string | null;
  timestamp?: Date;
}>): EasyModeAttemptRecoveryState {
  return Object.freeze({
    version: 1,
    projectId: input.projectId,
    runId: input.runId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    module: input.module,
    providerStatus: typeof input.providerStatus === "number" ? input.providerStatus : null,
    rawProviderResponse: input.rawProviderResponse === undefined ? null : safeRecoveryPayload(input.rawProviderResponse),
    normalizedResponse: input.normalizedResponse ? safeRecoveryPayload(input.normalizedResponse) as Record<string, unknown> : null,
    usage: input.usage ?? null,
    failureCategory: input.failureCategory ?? null,
    failurePoint: input.failurePoint ?? null,
    validationStage: input.validationStage ?? null,
    failedField: input.failedField?.trim() || null,
    timestamp: (input.timestamp ?? new Date()).toISOString(),
  });
}

export function parseAttemptRecoveryState(value: unknown): EasyModeAttemptRecoveryState | null {
  if (!isPlainRecord(value) || value.version !== 1) return null;
  const validationStage = EASY_MODE_VALIDATION_STAGES.includes(value.validationStage as EasyModeValidationStage)
    ? value.validationStage as EasyModeValidationStage
    : null;
  const failurePoint = value.failurePoint === "before_dispatch" || value.failurePoint === "uncertain"
    ? value.failurePoint
    : null;
  if (
    typeof value.projectId !== "string" ||
    typeof value.runId !== "string" ||
    typeof value.taskId !== "string" ||
    typeof value.attemptId !== "string" ||
    typeof value.module !== "string" ||
    typeof value.timestamp !== "string"
  ) {
    return null;
  }
  return buildAttemptRecoveryState({
    projectId: value.projectId,
    runId: value.runId,
    taskId: value.taskId,
    attemptId: value.attemptId,
    module: value.module,
    providerStatus: typeof value.providerStatus === "number" ? value.providerStatus : null,
    rawProviderResponse: value.rawProviderResponse,
    normalizedResponse: isPlainRecord(value.normalizedResponse) ? value.normalizedResponse : null,
    usage: isPlainRecord(value.usage) ? value.usage as AiUsageMetadata : null,
    failureCategory: typeof value.failureCategory === "string" ? value.failureCategory as EasyModeFailureCategory : null,
    failurePoint,
    validationStage,
    failedField: typeof value.failedField === "string" ? value.failedField : null,
    timestamp: new Date(value.timestamp),
  });
}

export function hasReplayableSavedResponse(state: EasyModeAttemptRecoveryState | null): boolean {
  return Boolean(state?.rawProviderResponse || state?.normalizedResponse);
}

const AUTO_RETRY_FAILURES = new Set<EasyModeFailureCategory>([
  "empty_response",
  "invalid_json",
  "provider_timeout",
  "safe_network_error",
  "temporary_upstream_5xx",
]);

export function isAutoRetryableFailureCategory(value: EasyModeFailureCategory | null | undefined): boolean {
  return value ? AUTO_RETRY_FAILURES.has(value) : false;
}
