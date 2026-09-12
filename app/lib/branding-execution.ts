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
  validateWrappedWebhookOutput,
} from "@/app/lib/specialist-execution";

export const BRANDING_AI_WORKFLOW = "branding-api";
const PROVIDER_TIMEOUT_MS = 120_000;
const BRANDING_REQUIRED_FIELDS = [
  "brandName",
  "tagline",
  "story",
  "mission",
  "vision",
  "brandVoice",
  "colorPalette",
  "typography",
  "logoConcept",
  "marketingSuggestions",
  "brandStyleGuide",
] as const;

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

type BrandingField = (typeof BRANDING_REQUIRED_FIELDS)[number];
type BrandingOutput = Readonly<Record<BrandingField, string>>;

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

function brandingInputText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildSafeBrandingFallbacks(input: ModuleExecutionInput): BrandingOutput {
  const companyName = brandingInputText(input.companyName, "The business");
  const industry = brandingInputText(input.industry, "business services");
  const targetAudience = brandingInputText(input.targetAudience, "customers");
  const brandStyle = brandingInputText(input.brandStyle, "professional");
  const companyNameLower = companyName.toLowerCase();
  const industryLower = industry.toLowerCase();
  const targetAudienceLower = targetAudience.toLowerCase();
  const brandStyleLower = brandStyle.toLowerCase();

  return Object.freeze({
    brandName: companyName,
    tagline: `${companyName} helps ${targetAudienceLower} move forward with clarity.`,
    story: `${companyName} brings a ${brandStyleLower} brand direction to ${industryLower}, with a clear focus on ${targetAudienceLower}.`,
    mission: `Present ${companyName} with clear messaging that reflects its ${industryLower} offering and customer focus.`,
    vision: `Build a consistent ${brandStyleLower} brand presence that helps ${targetAudienceLower} understand the value ${companyNameLower} provides.`,
    brandVoice: `Clear, ${brandStyleLower}, and focused on the verified needs of ${targetAudienceLower}.`,
    colorPalette: `Use a simple, accessible color system that supports a ${brandStyleLower} ${industryLower} brand presentation.`,
    typography: "Use readable typography with clear hierarchy for headings, body copy, and calls to action.",
    logoConcept: `Create a simple logo direction for ${companyName} that reflects its ${industryLower} focus and ${brandStyleLower} style.`,
    marketingSuggestions: `Focus marketing on the verified services, customer needs, and practical outcomes ${companyName} provides for ${targetAudienceLower}.`,
    brandStyleGuide: `Use a ${brandStyleLower} visual direction, clear messaging for ${targetAudienceLower}, and accessible presentation across customer-facing materials.`,
  });
}

function finalizeSanitizedBrandingOutput(
  input: ModuleExecutionInput,
  value: Record<string, string>,
): BrandingOutput | null {
  const validator = getModuleAdapter("branding")?.validateOutput;
  if (!validator) return null;
  const fallbacks = buildSafeBrandingFallbacks(input);
  const completed = Object.fromEntries(
    BRANDING_REQUIRED_FIELDS.map((field) => {
      const current = typeof value[field] === "string" ? value[field].trim() : "";
      return [field, current || fallbacks[field]];
    }),
  );
  const validated = validator(completed);
  return validated ? (validated as BrandingOutput) : null;
}

export function validateBrandingWebhookOutput(input: ModuleExecutionInput, value: unknown) {
  const validator = getModuleAdapter("branding")?.validateOutput;
  const validatedOutput = validator
    ? validateWrappedWebhookOutput(value, (candidate) => {
      const normalizedCandidate = candidate !== null && typeof candidate === "object" &&
          !Array.isArray(candidate) && !Object.hasOwn(candidate, "brandStyleGuide") &&
          typeof (candidate as Record<string, unknown>).brandVoice === "string" &&
          typeof (candidate as Record<string, unknown>).colorPalette === "string" &&
          typeof (candidate as Record<string, unknown>).typography === "string"
        ? {
            ...(candidate as Record<string, unknown>),
            brandStyleGuide: [
              `Brand voice: ${(candidate as Record<string, unknown>).brandVoice}`,
              `Color palette: ${(candidate as Record<string, unknown>).colorPalette}`,
              `Typography: ${(candidate as Record<string, unknown>).typography}`,
            ].join("\n"),
          }
        : candidate;
      return validator(candidate) ?? validator(normalizedCandidate);
    })
    : null;
  if (!validatedOutput) return null;
  const sanitizedOutput = sanitizeBrandingOutput(validatedOutput, input);
  if (!sanitizedOutput) return null;
  return finalizeSanitizedBrandingOutput(input, sanitizedOutput as Record<string, string>);
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
