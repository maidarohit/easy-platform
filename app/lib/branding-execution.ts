import "server-only";

import {
  getModuleAdapter,
  type ModuleExecutionInput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { confirmedDnaExecutionContext, loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";
import { sanitizeBrandingOutput } from "@/app/lib/branding-insight-safety";
import {
  executeValidatedJsonWebhook,
  SpecialistExecutionError,
  type ProviderFailureCategory,
  type SpecialistAsyncDispatchContext,
  type SpecialistExecutionResult,
  type SyncSpecialistExecutionResult,
} from "@/app/lib/specialist-execution";

export const BRANDING_AI_WORKFLOW = "branding-api";
const PROVIDER_TIMEOUT_MS = 120_000;

export type BrandingFailurePoint = "before_dispatch" | "uncertain";
export type BrandingSafeErrorCode = "PROVIDER_UNAVAILABLE" | "OUTPUT_INVALID" | "DELIVERY_UNCERTAIN";

export class BrandingExecutionError extends Error {
  readonly code: BrandingSafeErrorCode;
  readonly failurePoint: BrandingFailurePoint;
  readonly httpStatus: number;
  readonly failureCategory: ProviderFailureCategory | null;
  readonly upstreamStatus: number | null;

  constructor(
    code: BrandingSafeErrorCode,
    failurePoint: BrandingFailurePoint,
    httpStatus = 502,
    details: Readonly<{
      failureCategory?: ProviderFailureCategory | null;
      upstreamStatus?: number | null;
    }> = {},
  ) {
    super(code);
    this.name = "BrandingExecutionError";
    this.code = code;
    this.failurePoint = failurePoint;
    this.httpStatus = httpStatus;
    this.failureCategory = details.failureCategory ?? null;
    this.upstreamStatus = details.upstreamStatus ?? null;
  }
}

type BrandingWebhookConfig = Readonly<{
  url: string;
  headers: Readonly<Record<string, string>>;
}>;

export type BrandingExecutionOptions = Readonly<{
  context: TrustedModuleExecutionContext;
  input?: unknown;
  asyncDispatch?: SpecialistAsyncDispatchContext;
  fetcher?: typeof fetch;
  webhookConfig?: BrandingWebhookConfig;
}>;

export async function loadCanonicalBrandingInput(
  context: TrustedModuleExecutionContext,
): Promise<ModuleExecutionInput> {
  const ownedContext = await loadOwnedProjectContext(context);
  if (!ownedContext) throw new BrandingExecutionError("PROVIDER_UNAVAILABLE", "before_dispatch", 404);
  const { project, memory } = ownedContext;
  const dna = confirmedDnaExecutionContext(ownedContext);
  const companyName = dna?.companyName || memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim();
  const industry = dna?.industry || memory?.industry?.trim() || project.industry?.trim() || "Business services";
  const candidate = {
    companyName,
    industry,
    targetAudience: (dna?.targetAudience || memory?.targetAudience?.trim() || project.targetAudience?.trim() ||
      `Customers interested in ${industry}`).slice(0, 500),
    brandStyle: (dna?.brandStyle || memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional").slice(0, 500),
    brandDescription: dna?.businessDescription || memory?.businessDescription?.trim() || project.brandDescription?.trim() ||
      project.originalBrief?.trim() || `${companyName} provides ${industry.toLowerCase()} products or services.`,
  };
  const validated = getModuleAdapter("branding")?.validateInput(candidate);
  if (!validated) throw new BrandingExecutionError("OUTPUT_INVALID", "before_dispatch", 400);
  return validated;
}

export function validateBrandingWebhookOutput(input: ModuleExecutionInput, value: unknown) {
  const validator = getModuleAdapter("branding")?.validateOutput;
  const responseItem = Array.isArray(value) && value.length === 1 ? value[0] : value;
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
  const validatedOutput = validator?.(responseItem) ?? validator?.(normalizedCandidate);
  return validatedOutput ? sanitizeBrandingOutput(validatedOutput, input) : null;
}

export function executeBrandingService(
  options: BrandingExecutionOptions & Readonly<{ asyncDispatch?: undefined }>,
): Promise<SyncSpecialistExecutionResult>;
export function executeBrandingService(
  options: BrandingExecutionOptions & Readonly<{ asyncDispatch: SpecialistAsyncDispatchContext }>,
): Promise<SpecialistExecutionResult>;
export async function executeBrandingService(options: BrandingExecutionOptions): Promise<SpecialistExecutionResult> {
  const input = options.input === undefined
    ? await loadCanonicalBrandingInput(options.context)
    : getModuleAdapter("branding")?.validateInput(options.input);
  if (!input) throw new BrandingExecutionError("OUTPUT_INVALID", "before_dispatch", 400);

  const webhook = options.webhookConfig ?? getN8nWebhookConfig("N8N_BRANDING_AI_WEBHOOK_URL");
  if (!webhook) throw new BrandingExecutionError("PROVIDER_UNAVAILABLE", "before_dispatch", 503);
  try {
    const baseOptions = {
      input,
      webhook,
      timeoutMs: PROVIDER_TIMEOUT_MS,
      fetcher: options.fetcher,
      validateResponse: (value: unknown) => validateBrandingWebhookOutput(input, value),
    } as const;
    if (options.asyncDispatch) {
      return await executeValidatedJsonWebhook({
        ...baseOptions,
        asyncDispatch: options.asyncDispatch,
      });
    }
    return await executeValidatedJsonWebhook(baseOptions);
  } catch (error) {
    if (error instanceof BrandingExecutionError) throw error;
    if (error instanceof SpecialistExecutionError) {
      throw new BrandingExecutionError(
        error.failureCategory === "schema_validation_failure" ||
            error.failureCategory === "oversized_response" ||
            error.failureCategory === "empty_response" ||
            error.failureCategory === "invalid_json"
          ? "OUTPUT_INVALID"
          : error.failurePoint === "before_dispatch"
            ? "PROVIDER_UNAVAILABLE"
            : "DELIVERY_UNCERTAIN",
        error.failurePoint,
        error.httpStatus,
        {
          failureCategory: error.failureCategory ?? null,
          upstreamStatus: error.upstreamStatus ?? null,
        },
      );
    }
    throw error;
  }
}
