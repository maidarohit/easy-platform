import "server-only";

import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import type { NormalizedModuleOutput } from "@/app/lib/easy-mode-execution-contracts";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";

const MAX_RESPONSE_BYTES = 256 * 1024;

export class SpecialistExecutionError extends Error {
  readonly failurePoint: "before_dispatch" | "uncertain";
  readonly httpStatus: number;

  constructor(failurePoint: "before_dispatch" | "uncertain", httpStatus = 502) {
    super(failurePoint === "before_dispatch" ? "PROVIDER_UNAVAILABLE" : "DELIVERY_UNCERTAIN");
    this.name = "SpecialistExecutionError";
    this.failurePoint = failurePoint;
    this.httpStatus = httpStatus;
  }
}

export type SpecialistExecutionResult = Readonly<{
  output: NormalizedModuleOutput;
  usageComponents?: readonly AiUsageComponent[];
  providerExecutionId?: string;
}>;

const WEBHOOK_WRAPPER_KEYS = new Set(["body", "data", "json", "output", "response", "result"]);

export function validateWrappedWebhookOutput<T extends NormalizedModuleOutput>(
  value: unknown,
  validate: (candidate: unknown) => T | null,
): T | null {
  const found = new Map<string, T>();
  const visit = (candidate: unknown, depth: number) => {
    if (depth > 8) return;
    const output = validate(candidate);
    if (output) found.set(JSON.stringify(output), output);
    if (Array.isArray(candidate)) {
      if (candidate.length === 1) visit(candidate[0], depth + 1);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, nested] of Object.entries(candidate)) {
      if (WEBHOOK_WRAPPER_KEYS.has(key)) visit(nested, depth + 1);
    }
  };
  visit(value, 0);
  return found.size === 1 ? found.values().next().value ?? null : null;
}

export async function executeValidatedJsonWebhook(options: Readonly<{
  input: Readonly<Record<string, unknown>>;
  webhook: Readonly<{ url: string; headers: Readonly<Record<string, string>> }> | null;
  timeoutMs: number;
  validateResponse: (value: unknown) => NormalizedModuleOutput | null;
  fetcher?: typeof fetch;
}>): Promise<SpecialistExecutionResult> {
  if (!options.webhook) throw new SpecialistExecutionError("before_dispatch", 503);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(options.webhook.url, {
      method: "POST",
      headers: options.webhook.headers,
      body: JSON.stringify(options.input),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch {
    throw new SpecialistExecutionError("uncertain");
  }
  if (!response.ok) throw new SpecialistExecutionError("uncertain", response.status);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new SpecialistExecutionError("uncertain");
  }
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new SpecialistExecutionError("uncertain");
  }
  if (!raw.trim() || Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
    throw new SpecialistExecutionError("uncertain");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SpecialistExecutionError("uncertain");
  }
  const output = options.validateResponse(parsed);
  if (!output) throw new SpecialistExecutionError("uncertain");
  const usage = parseAiUsageMetadata(response.headers);
  const executionId = parseN8nExecutionId(response.headers);
  return Object.freeze({
    output,
    ...(usage ? { usageComponents: usage.components } : {}),
    ...(executionId ? { providerExecutionId: executionId } : {}),
  });
}
