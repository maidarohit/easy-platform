import "server-only";

import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import type { EasyModeValidationStage } from "@/app/lib/easy-mode-recovery-state";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import { isEasyModeModuleId, type EasyModeModuleId, type NormalizedModuleOutput } from "@/app/lib/easy-mode-execution-contracts";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_IDENTIFIER_LENGTH = 128;
export type ProviderFailureCategory =
  | "timeout"
  | "fetch_network_error"
  | "upstream_non_2xx"
  | "empty_response"
  | "oversized_response"
  | "invalid_json"
  | "schema_validation_failure";

export class SpecialistExecutionError extends Error {
  readonly failurePoint: "before_dispatch" | "uncertain";
  readonly httpStatus: number;
  readonly failureCategory: ProviderFailureCategory | null;
  readonly upstreamStatus: number | null;
  readonly validationStage: EasyModeValidationStage | null;
  readonly rawProviderResponse: string | null;
  readonly parsedProviderResponse: unknown;

  constructor(
    failurePoint: "before_dispatch" | "uncertain",
    httpStatus = 502,
    details: Readonly<{
      failureCategory?: ProviderFailureCategory | null;
      upstreamStatus?: number | null;
      validationStage?: EasyModeValidationStage | null;
      rawProviderResponse?: string | null;
      parsedProviderResponse?: unknown;
    }> = {},
  ) {
    super(failurePoint === "before_dispatch" ? "PROVIDER_UNAVAILABLE" : "DELIVERY_UNCERTAIN");
    this.name = "SpecialistExecutionError";
    this.failurePoint = failurePoint;
    this.httpStatus = httpStatus;
    this.failureCategory = details.failureCategory ?? null;
    this.upstreamStatus = details.upstreamStatus ?? null;
    this.validationStage = details.validationStage ?? null;
    this.rawProviderResponse = details.rawProviderResponse ?? null;
    this.parsedProviderResponse = details.parsedProviderResponse;
  }
}

export type SyncSpecialistExecutionResult = Readonly<{
  dispatchMode: "sync";
  output: NormalizedModuleOutput;
  usageComponents?: readonly AiUsageComponent[];
  providerExecutionId?: string;
  providerStatus: number;
  rawProviderResponse: string;
  parsedProviderResponse: unknown;
}>;

export type AsyncSpecialistExecutionResult = Readonly<{
  dispatchMode: "async";
  module: SpecialistProviderModule;
  attemptId: string;
  executionKey: string;
  callbackStatus: "accepted" | "queued" | "processing";
  providerExecutionId?: string;
}>;

export type SpecialistExecutionResult = SyncSpecialistExecutionResult | AsyncSpecialistExecutionResult;

export type SpecialistProviderModule = Exclude<EasyModeModuleId, "ai-manager" | "branding-context">;
export type SpecialistAsyncDispatchContext = Readonly<{
  runId: string;
  taskId: string;
  attemptId: string;
  executionKey: string;
  projectId: string;
  module: SpecialistProviderModule;
  callbackUrl: string;
  correlationId: string;
}>;
type SpecialistAsyncAcknowledgement = AsyncSpecialistExecutionResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function normalizedIdentifier(value: unknown, pattern = /^[A-Za-z0-9_-]+$/): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_IDENTIFIER_LENGTH && pattern.test(normalized)
    ? normalized
    : null;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

const WEBHOOK_WRAPPER_KEYS = ["body", "data", "json", "output", "response", "result", "text"] as const;

function parseJsonString(value: unknown) {
  let current = value;
  for (let depth = 0; depth < 4 && typeof current === "string"; depth += 1) {
    if (Buffer.byteLength(current, "utf8") > MAX_RESPONSE_BYTES) return null;
    try {
      current = JSON.parse(current) as unknown;
    } catch {
      break;
    }
  }
  return current;
}

export function unwrapSingleWebhookCandidate(value: unknown): unknown | null {
  const candidates: unknown[] = [];
  const visit = (candidate: unknown, depth: number) => {
    if (depth > 8) return;
    const parsed = parseJsonString(candidate);
    if (parsed === null) return;
    if (Array.isArray(parsed)) {
      if (parsed.length === 1) visit(parsed[0], depth + 1);
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    let wrapped = false;
    for (const [key, nested] of Object.entries(parsed)) {
      if (WEBHOOK_WRAPPER_KEYS.includes(key as (typeof WEBHOOK_WRAPPER_KEYS)[number])) {
        wrapped = true;
        visit(nested, depth + 1);
      }
    }
    if (!wrapped) candidates.push(parsed);
  };
  visit(value, 0);
  const unique = [...new Map(candidates.map((candidate) => [JSON.stringify(candidate), candidate])).values()];
  return unique.length === 1 ? unique[0] ?? null : null;
}

export function validateWrappedWebhookOutput<T extends NormalizedModuleOutput>(
  value: unknown,
  validate: (candidate: unknown) => T | null,
): T | null {
  const found = new Map<string, T>();
  const candidate = unwrapSingleWebhookCandidate(value);
  if (candidate !== null) {
    const output = validate(candidate);
    if (output) found.set(JSON.stringify(output), output);
  }
  return found.size === 1 ? found.values().next().value ?? null : null;
}

export function buildSpecialistDispatchEnvelope(
  dispatch: SpecialistAsyncDispatchContext,
): Readonly<{
  version: 1;
  dispatchMode: "async-capable";
  correlationId: string;
  runId: string;
  taskId: string;
  attemptId: string;
  executionKey: string;
  projectId: string;
  module: SpecialistProviderModule;
  callbackUrl: string;
  callbackAuth: Readonly<{ type: "bearer" }>;
}> {
  return Object.freeze({
    version: 1,
    dispatchMode: "async-capable",
    correlationId: dispatch.correlationId,
    runId: dispatch.runId,
    taskId: dispatch.taskId,
    attemptId: dispatch.attemptId,
    executionKey: dispatch.executionKey,
    projectId: dispatch.projectId,
    module: dispatch.module,
    callbackUrl: dispatch.callbackUrl,
    callbackAuth: Object.freeze({ type: "bearer" as const }),
  });
}

export function validateSpecialistAsyncAcknowledgement(
  value: unknown,
  expected: Readonly<{
    module: SpecialistProviderModule;
    attemptId: string;
    executionKey: string;
  }>,
): SpecialistAsyncAcknowledgement | null {
  if (!isRecord(value) || !exactKeys(value,
    ["dispatchMode", "status", "attemptId", "executionKey", "module"],
    ["providerExecutionId"])) return null;
  if (value.dispatchMode !== "async") return null;
  const attemptId = normalizedIdentifier(value.attemptId, /^[0-9a-f-]+$/i);
  const executionKey = normalizedIdentifier(value.executionKey);
  const providerExecutionId = value.providerExecutionId === undefined ? null : normalizedIdentifier(value.providerExecutionId);
  const status = normalizedIdentifier(value.status);
  if (!attemptId || !executionKey || !providerExecutionId && value.providerExecutionId !== undefined) return null;
  if (!isEasyModeModuleId(value.module) || value.module === "ai-manager" || value.module === "branding-context") return null;
  if (attemptId !== expected.attemptId || executionKey !== expected.executionKey || value.module !== expected.module) return null;
  if (status !== "accepted" && status !== "queued" && status !== "processing") return null;
  return Object.freeze({
    dispatchMode: "async",
    module: value.module,
    attemptId,
    executionKey,
    callbackStatus: status,
    ...(providerExecutionId ? { providerExecutionId } : {}),
  });
}

export function executeValidatedJsonWebhook(options: Readonly<{
  input: Readonly<Record<string, unknown>>;
  webhook: Readonly<{ url: string; headers: Readonly<Record<string, string>> }> | null;
  timeoutMs: number;
  validateResponse: (value: unknown) => NormalizedModuleOutput | null;
  asyncDispatch?: undefined;
  fetcher?: typeof fetch;
}>): Promise<SyncSpecialistExecutionResult>;
export function executeValidatedJsonWebhook(options: Readonly<{
  input: Readonly<Record<string, unknown>>;
  webhook: Readonly<{ url: string; headers: Readonly<Record<string, string>> }> | null;
  timeoutMs: number;
  validateResponse: (value: unknown) => NormalizedModuleOutput | null;
  asyncDispatch: SpecialistAsyncDispatchContext;
  fetcher?: typeof fetch;
}>): Promise<SpecialistExecutionResult>;
export async function executeValidatedJsonWebhook(options: Readonly<{
  input: Readonly<Record<string, unknown>>;
  webhook: Readonly<{ url: string; headers: Readonly<Record<string, string>> }> | null;
  timeoutMs: number;
  validateResponse: (value: unknown) => NormalizedModuleOutput | null;
  asyncDispatch?: SpecialistAsyncDispatchContext;
  fetcher?: typeof fetch;
}>): Promise<SpecialistExecutionResult> {
  if (!options.webhook) throw new SpecialistExecutionError("before_dispatch", 503);
  let response: Response;
  try {
    const payload = options.asyncDispatch
      ? { ...options.input, orchestration: buildSpecialistDispatchEnvelope(options.asyncDispatch) }
      : options.input;
    response = await (options.fetcher ?? fetch)(options.webhook.url, {
      method: "POST",
      headers: options.webhook.headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new SpecialistExecutionError("uncertain", 504, { failureCategory: "timeout" });
    }
    throw new SpecialistExecutionError("uncertain", 502, { failureCategory: "fetch_network_error" });
  }
  if (!response.ok) {
    throw new SpecialistExecutionError("uncertain", response.status, {
      failureCategory: "upstream_non_2xx",
      upstreamStatus: response.status,
    });
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new SpecialistExecutionError("uncertain", 502, { failureCategory: "oversized_response" });
  }
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new SpecialistExecutionError("uncertain", 502, { failureCategory: "fetch_network_error" });
  }
  if (!raw.trim()) {
    throw new SpecialistExecutionError("uncertain", 502, {
      failureCategory: "empty_response",
      validationStage: "provider_response",
      rawProviderResponse: raw,
      parsedProviderResponse: null,
    });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
    throw new SpecialistExecutionError("uncertain", 502, { failureCategory: "oversized_response" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SpecialistExecutionError("uncertain", 502, {
      failureCategory: "invalid_json",
      validationStage: "unwrap",
      rawProviderResponse: raw,
      parsedProviderResponse: null,
    });
  }
  if (response.status === 202) {
    if (!options.asyncDispatch) {
      throw new SpecialistExecutionError("uncertain", 502, {
        failureCategory: "schema_validation_failure",
        validationStage: "initial_contract",
        upstreamStatus: response.status,
        rawProviderResponse: raw,
        parsedProviderResponse: parsed,
      });
    }
    const acknowledgement = validateSpecialistAsyncAcknowledgement(parsed, {
      module: options.asyncDispatch.module,
      attemptId: options.asyncDispatch.attemptId,
      executionKey: options.asyncDispatch.executionKey,
    });
    if (!acknowledgement) {
      throw new SpecialistExecutionError("uncertain", 502, {
        failureCategory: "schema_validation_failure",
        validationStage: "initial_contract",
        upstreamStatus: response.status,
        rawProviderResponse: raw,
        parsedProviderResponse: parsed,
      });
    }
    const executionId = acknowledgement.providerExecutionId ?? parseN8nExecutionId(response.headers);
    return Object.freeze({
      ...acknowledgement,
      ...(executionId ? { providerExecutionId: executionId } : {}),
    });
  }
  const output = options.validateResponse(parsed);
  if (!output) {
    throw new SpecialistExecutionError("uncertain", 502, {
      failureCategory: "schema_validation_failure",
      validationStage: "final_contract",
      upstreamStatus: response.status,
      rawProviderResponse: raw,
      parsedProviderResponse: parsed,
    });
  }
  const usage = parseAiUsageMetadata(response.headers);
  const executionId = parseN8nExecutionId(response.headers);
  return Object.freeze({
    dispatchMode: "sync",
    output,
    providerStatus: response.status,
    rawProviderResponse: raw,
    parsedProviderResponse: parsed,
    ...(usage ? { usageComponents: usage.components } : {}),
    ...(executionId ? { providerExecutionId: executionId } : {}),
  });
}
