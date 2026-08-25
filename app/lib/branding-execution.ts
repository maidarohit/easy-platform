import "server-only";

import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import {
  getModuleAdapter,
  type ModuleExecutionInput,
  type NormalizedModuleOutput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";

export const BRANDING_AI_WORKFLOW = "branding-api";
const PROVIDER_TIMEOUT_MS = 120_000;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

export type BrandingFailurePoint = "before_dispatch" | "uncertain";
export type BrandingSafeErrorCode = "PROVIDER_UNAVAILABLE" | "OUTPUT_INVALID" | "DELIVERY_UNCERTAIN";

export class BrandingExecutionError extends Error {
  readonly code: BrandingSafeErrorCode;
  readonly failurePoint: BrandingFailurePoint;
  readonly httpStatus: number;

  constructor(code: BrandingSafeErrorCode, failurePoint: BrandingFailurePoint, httpStatus = 502) {
    super(code);
    this.name = "BrandingExecutionError";
    this.code = code;
    this.failurePoint = failurePoint;
    this.httpStatus = httpStatus;
  }
}

export type BrandingExecutionResult = Readonly<{
  output: NormalizedModuleOutput;
  usageComponents?: readonly AiUsageComponent[];
  providerExecutionId?: string;
}>;

type BrandingWebhookConfig = Readonly<{
  url: string;
  headers: Readonly<Record<string, string>>;
}>;

export type BrandingExecutionOptions = Readonly<{
  context: TrustedModuleExecutionContext;
  input?: unknown;
  fetcher?: typeof fetch;
  webhookConfig?: BrandingWebhookConfig;
}>;

export async function loadCanonicalBrandingInput(
  context: TrustedModuleExecutionContext,
): Promise<ModuleExecutionInput> {
  const ownedContext = await loadOwnedProjectContext(context);
  if (!ownedContext) throw new BrandingExecutionError("PROVIDER_UNAVAILABLE", "before_dispatch", 404);
  const { project, memory } = ownedContext;
  const companyName = memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim();
  const industry = memory?.industry?.trim() || project.industry?.trim() || "Business services";
  const candidate = {
    companyName,
    industry,
    targetAudience: memory?.targetAudience?.trim() || project.targetAudience?.trim() || `Customers interested in ${industry}`,
    brandStyle: memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional",
    brandDescription: memory?.businessDescription?.trim() || project.brandDescription?.trim() ||
      project.originalBrief?.trim() || `${companyName} provides ${industry.toLowerCase()} products or services.`,
  };
  const validated = getModuleAdapter("branding")?.validateInput(candidate);
  if (!validated) throw new BrandingExecutionError("OUTPUT_INVALID", "before_dispatch", 400);
  return validated;
}

export async function executeBrandingService(options: BrandingExecutionOptions): Promise<BrandingExecutionResult> {
  const input = options.input === undefined
    ? await loadCanonicalBrandingInput(options.context)
    : getModuleAdapter("branding")?.validateInput(options.input);
  if (!input) throw new BrandingExecutionError("OUTPUT_INVALID", "before_dispatch", 400);

  const webhook = options.webhookConfig ?? getN8nWebhookConfig("N8N_BRANDING_AI_WEBHOOK_URL");
  if (!webhook) throw new BrandingExecutionError("PROVIDER_UNAVAILABLE", "before_dispatch", 503);
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch {
    throw new BrandingExecutionError("DELIVERY_UNCERTAIN", "uncertain", 502);
  }

  if (!response.ok) throw new BrandingExecutionError("DELIVERY_UNCERTAIN", "uncertain", response.status);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new BrandingExecutionError("DELIVERY_UNCERTAIN", "uncertain", 502);
  }
  if (!raw.trim() || Buffer.byteLength(raw, "utf8") > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502);
  }
  const validator = getModuleAdapter("branding")?.validateOutput;
  const responseItem = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
  const responseOutput = responseItem !== null && typeof responseItem === "object" && !Array.isArray(responseItem) &&
      Object.hasOwn(responseItem, "output")
    ? (responseItem as Record<string, unknown>).output
    : responseItem;
  const normalizedCandidate = responseOutput !== null && typeof responseOutput === "object" &&
      !Array.isArray(responseOutput) && !Object.hasOwn(responseOutput, "brandStyleGuide") &&
      typeof (responseOutput as Record<string, unknown>).brandVoice === "string" &&
      typeof (responseOutput as Record<string, unknown>).colorPalette === "string" &&
      typeof (responseOutput as Record<string, unknown>).typography === "string"
    ? {
        ...(responseOutput as Record<string, unknown>),
        brandStyleGuide: [
          `Brand voice: ${(responseOutput as Record<string, unknown>).brandVoice}`,
          `Color palette: ${(responseOutput as Record<string, unknown>).colorPalette}`,
          `Typography: ${(responseOutput as Record<string, unknown>).typography}`,
        ].join("\n"),
      }
    : responseOutput;
  const output = validator?.(responseItem) ?? validator?.(normalizedCandidate);
  if (!output) throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502);

  const usageMetadata = parseAiUsageMetadata(response.headers);
  const providerExecutionId = parseN8nExecutionId(response.headers);
  return Object.freeze({
    output,
    ...(usageMetadata ? { usageComponents: usageMetadata.components } : {}),
    ...(providerExecutionId ? { providerExecutionId } : {}),
  });
}
