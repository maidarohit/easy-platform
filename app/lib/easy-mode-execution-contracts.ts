import "server-only";

import type { UsageCategory } from "@/app/lib/plan-config";

export const EASY_MODE_MODULE_IDS = [
  "ai-manager",
  "branding",
  "website",
  "marketing",
  "seo",
  "uiux",
  "sales",
  "analytics",
  "content",
  "logo",
  "branding-context",
] as const;

export type EasyModeModuleId = (typeof EASY_MODE_MODULE_IDS)[number];
export type EasyModePlannedModuleId = EasyModeModuleId | "image";

export function isEasyModeModuleId(value: unknown): value is EasyModeModuleId {
  return typeof value === "string" && EASY_MODE_MODULE_IDS.includes(value as EasyModeModuleId);
}

export function isEasyModePlannedModuleId(value: unknown): value is EasyModePlannedModuleId {
  return value === "image" || isEasyModeModuleId(value);
}

const trustedExecutionContext: unique symbol = Symbol("trusted-module-execution-context");

export type TrustedModuleExecutionContext = Readonly<{
  userId: string;
  projectId: string;
  runId?: string;
  taskId?: string;
  [trustedExecutionContext]: true;
}>;

export type ModuleExecutionInput = Readonly<Record<string, unknown>>;

export type NormalizedModuleOutput = Readonly<Record<string, string | Readonly<Record<string, unknown>>>>;

export type ModuleExecutionResult<TOutput extends NormalizedModuleOutput = NormalizedModuleOutput> = Readonly<{
  moduleId: EasyModeModuleId;
  status: "validated";
  output: TOutput;
}>;

type ContextSource = Readonly<{
  userId: string;
  projectId: string;
  runId?: string;
  taskId?: string;
}>;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTrustedModuleExecutionContext(source: ContextSource): TrustedModuleExecutionContext {
  if (!ID_PATTERN.test(source.userId) || !ID_PATTERN.test(source.projectId)) {
    throw new Error("Invalid trusted execution context.");
  }
  if ((source.runId && !UUID_PATTERN.test(source.runId)) || (source.taskId && !UUID_PATTERN.test(source.taskId))) {
    throw new Error("Invalid trusted execution context.");
  }
  return Object.freeze({ ...source, [trustedExecutionContext]: true as const });
}

const MAX_FIELD_LENGTH = 20_000;
const MAX_SHORT_FIELD_LENGTH = 500;
const MAX_OUTPUT_BYTES = 180_000;
const UNSAFE_TEXT = /<\s*\/?\s*[a-z][^>]*>|javascript\s*:|on[a-z]+\s*=|\u0000/i;

type StringRules = Readonly<Record<string, number>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

function safeString(value: unknown, maximum = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > maximum || Buffer.byteLength(normalized, "utf8") > maximum * 4) return null;
  return UNSAFE_TEXT.test(normalized) ? null : normalized;
}

function unwrapProviderOutput(value: unknown): unknown {
  if (!isRecord(value) || !exactKeys(value, [], ["output"]) || !Object.hasOwn(value, "output")) return value;
  const output = value.output;
  if (typeof output !== "string") return output;
  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) return null;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return output;
  }
}

function validateStringObject(
  value: unknown,
  required: StringRules,
  optional: StringRules = {},
): Readonly<Record<string, string>> | null {
  const candidate = unwrapProviderOutput(value);
  if (!isRecord(candidate) || !exactKeys(candidate, Object.keys(required), Object.keys(optional))) return null;
  const normalized: Record<string, string> = {};
  for (const [key, maximum] of Object.entries({ ...required, ...optional })) {
    if (!Object.hasOwn(candidate, key)) continue;
    const item = safeString(candidate[key], maximum);
    if (!item) return null;
    normalized[key] = item;
  }
  try {
    if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > MAX_OUTPUT_BYTES) return null;
  } catch {
    return null;
  }
  return Object.freeze(normalized);
}

const BRAND_PROFILE_INPUT: StringRules = {
  companyName: MAX_SHORT_FIELD_LENGTH,
  industry: MAX_SHORT_FIELD_LENGTH,
  targetAudience: MAX_SHORT_FIELD_LENGTH,
  brandStyle: MAX_SHORT_FIELD_LENGTH,
  brandDescription: 4_000,
};

const OUTPUT_RULES = {
  branding: {
    brandName: 1_000, tagline: 2_000, story: MAX_FIELD_LENGTH, mission: MAX_FIELD_LENGTH,
    vision: MAX_FIELD_LENGTH, brandVoice: MAX_FIELD_LENGTH, colorPalette: MAX_FIELD_LENGTH,
    typography: MAX_FIELD_LENGTH, logoConcept: MAX_FIELD_LENGTH,
    marketingSuggestions: MAX_FIELD_LENGTH, brandStyleGuide: MAX_FIELD_LENGTH,
  },
  website: {
    websiteOverview: MAX_FIELD_LENGTH, websiteGoal: MAX_FIELD_LENGTH,
    recommendedPages: MAX_FIELD_LENGTH, siteStructure: MAX_FIELD_LENGTH,
    websiteFeatures: MAX_FIELD_LENGTH, designRecommendations: MAX_FIELD_LENGTH,
    colourScheme: MAX_FIELD_LENGTH, typography: MAX_FIELD_LENGTH,
    recommendedTechStack: MAX_FIELD_LENGTH, seoRecommendations: MAX_FIELD_LENGTH,
  },
  marketing: {
    marketingStrategy: MAX_FIELD_LENGTH, contentIdeas: MAX_FIELD_LENGTH,
    socialMediaStrategy: MAX_FIELD_LENGTH, adCopy: MAX_FIELD_LENGTH,
    contentCalendar: MAX_FIELD_LENGTH, targetAudienceAnalysis: MAX_FIELD_LENGTH,
    emailMarketing: MAX_FIELD_LENGTH, paidAdsStrategy: MAX_FIELD_LENGTH,
    typography: MAX_FIELD_LENGTH, recommendedTechStack: MAX_FIELD_LENGTH,
    seoRecommendations: MAX_FIELD_LENGTH, funnelSuggestions: MAX_FIELD_LENGTH,
    kpis: MAX_FIELD_LENGTH, growthRecommendations: MAX_FIELD_LENGTH,
    marketingScore: 1_000, bestChannels: MAX_FIELD_LENGTH,
    campaignTimeline: MAX_FIELD_LENGTH, customerJourney: MAX_FIELD_LENGTH,
    contentMix: MAX_FIELD_LENGTH,
  },
  seo: {
    seoAudit: MAX_FIELD_LENGTH, keywords: MAX_FIELD_LENGTH, metaTitles: MAX_FIELD_LENGTH,
    metaDescriptions: MAX_FIELD_LENGTH, internalLinking: MAX_FIELD_LENGTH,
    blogTopics: MAX_FIELD_LENGTH, technicalSEO: MAX_FIELD_LENGTH,
    kpis: MAX_FIELD_LENGTH, growthRecommendations: MAX_FIELD_LENGTH,
  },
  uiux: {
    accessibility: MAX_FIELD_LENGTH, designSystem: MAX_FIELD_LENGTH,
    desktopExperience: MAX_FIELD_LENGTH, microInteractions: MAX_FIELD_LENGTH,
    mobileExperience: MAX_FIELD_LENGTH, uiuxStrategy: MAX_FIELD_LENGTH,
    userFlow: MAX_FIELD_LENGTH, userPersonas: MAX_FIELD_LENGTH, wireframes: MAX_FIELD_LENGTH,
  },
  sales: {
    executiveSummary: MAX_FIELD_LENGTH, targetCustomerProfile: MAX_FIELD_LENGTH,
    salesFunnel: MAX_FIELD_LENGTH, leadGenerationStrategy: MAX_FIELD_LENGTH,
    salesChannels: MAX_FIELD_LENGTH, outreachStrategy: MAX_FIELD_LENGTH,
    pricingRecommendations: MAX_FIELD_LENGTH, salesKPIs: MAX_FIELD_LENGTH,
    actionPlan: MAX_FIELD_LENGTH, salesScript: MAX_FIELD_LENGTH,
    proposal: MAX_FIELD_LENGTH, closingStrategy: MAX_FIELD_LENGTH,
  },
  analytics: {
    executiveSummary: MAX_FIELD_LENGTH, businessHealthScore: 1_000,
    trafficAnalysis: MAX_FIELD_LENGTH, leadAnalysis: MAX_FIELD_LENGTH,
    salesPerformance: MAX_FIELD_LENGTH, revenueAnalysis: MAX_FIELD_LENGTH,
    marketingPerformance: MAX_FIELD_LENGTH, conversionAnalysis: MAX_FIELD_LENGTH,
    customerInsights: MAX_FIELD_LENGTH, growthOpportunities: MAX_FIELD_LENGTH,
    keyProblems: MAX_FIELD_LENGTH, aiRecommendations: MAX_FIELD_LENGTH,
    actionPlan90Days: MAX_FIELD_LENGTH,
  },
  logo: {
    concept: MAX_FIELD_LENGTH, symbol: MAX_FIELD_LENGTH, colors: MAX_FIELD_LENGTH,
    typography: MAX_FIELD_LENGTH, meaning: MAX_FIELD_LENGTH,
  },
  "ai-manager": {
    overview: 25_000, branding: 25_000, website: 25_000, marketing: 25_000,
    seo: 25_000, uiux: 25_000, sales: 25_000, analytics: 25_000,
  },
} as const satisfies Record<string, StringRules>;

export const validateBrandingOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.branding);

export function validateWebsiteOutput(value: unknown): Readonly<Record<string, string | Readonly<Record<string, string>>>> | null {
  const candidate = unwrapProviderOutput(value);
  if (!isRecord(candidate)) return null;
  const websiteEdits = candidate.websiteEdits;
  const base = { ...candidate };
  delete base.websiteEdits;
  const normalized = validateStringObject(base, OUTPUT_RULES.website);
  if (!normalized) return null;
  if (websiteEdits === undefined) return normalized;
  const edits = validateStringObject(websiteEdits, {
    companyName: 500, heroHeadline: 2_000, heroDescription: 10_000, aboutText: 20_000,
    servicesText: 20_000, phone: 100, email: 320, address: 1_000, whatsapp: 100,
    primaryCtaLabel: 200, primaryCtaLink: 2_000, template: 100,
  });
  if (!edits || !isSafeCtaLink(edits.primaryCtaLink)) return null;
  return Object.freeze({ ...normalized, websiteEdits: edits });
}

function isSafeCtaLink(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "mailto:" || url.protocol === "tel:";
  } catch {
    return false;
  }
}

export const validateMarketingOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.marketing);
export const validateSeoOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.seo, {
  colourScheme: MAX_FIELD_LENGTH, designRecommendations: MAX_FIELD_LENGTH,
  keywordResearch: MAX_FIELD_LENGTH, recommendedPages: MAX_FIELD_LENGTH,
  seoContentPlan: MAX_FIELD_LENGTH, seoScore: 1_000, seoStrategy: MAX_FIELD_LENGTH,
  siteStructure: MAX_FIELD_LENGTH, typography: MAX_FIELD_LENGTH, websiteFeatures: MAX_FIELD_LENGTH,
});
export const validateUiuxOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.uiux, { colourScheme: MAX_FIELD_LENGTH });
export const validateSalesOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.sales);
export const validateAnalyticsOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.analytics);
export const validateLogoOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES.logo);
export const validateAiManagerOutput = (value: unknown) => validateStringObject(value, OUTPUT_RULES["ai-manager"]);

export function validateContentOutput(value: unknown): Readonly<{ content: string }> | null {
  const candidate = unwrapProviderOutput(value);
  if (typeof candidate === "string") {
    const content = safeString(candidate);
    return content ? Object.freeze({ content }) : null;
  }
  return validateStringObject(candidate, { content: MAX_FIELD_LENGTH }) as Readonly<{ content: string }> | null;
}

export type ModuleOutputValidator = (value: unknown) => NormalizedModuleOutput | null;

function inputValidator(required: StringRules, optional: StringRules = {}) {
  return (value: unknown): ModuleExecutionInput | null => validateStringObject(value, required, optional);
}

export type ModuleExecutionSupport = "provider-disabled-phase-3a" | "local-only" | "unsupported";

export type ModuleAdapter = Readonly<{
  moduleId: EasyModePlannedModuleId;
  usageCategory: UsageCategory | null;
  executionSupport: ModuleExecutionSupport;
  validateInput: (value: unknown) => ModuleExecutionInput | null;
  validateOutput: ModuleOutputValidator | null;
  unsupportedReason?: string;
}>;

const ADAPTERS: Readonly<Record<EasyModePlannedModuleId, ModuleAdapter>> = Object.freeze({
  "ai-manager": adapter("ai-manager", "aiManagerRuns", inputValidator({ companyName: 500, businessDescription: 4_000, industry: 500, businessGoal: 4_000 }), validateAiManagerOutput),
  branding: adapter("branding", "standardAiTasks", inputValidator(BRAND_PROFILE_INPUT), validateBrandingOutput),
  website: adapter("website", "standardAiTasks", inputValidator(BRAND_PROFILE_INPUT), validateWebsiteOutput),
  marketing: adapter("marketing", "standardAiTasks", inputValidator(BRAND_PROFILE_INPUT), validateMarketingOutput),
  seo: adapter("seo", "standardAiTasks", inputValidator(BRAND_PROFILE_INPUT), validateSeoOutput),
  uiux: adapter("uiux", "standardAiTasks", inputValidator(BRAND_PROFILE_INPUT), validateUiuxOutput),
  sales: adapter("sales", "standardAiTasks", inputValidator({ companyName: 500, industry: 500, salesGoal: 500, targetAudience: 500, businessDescription: 4_000 }), validateSalesOutput),
  analytics: adapter("analytics", "standardAiTasks", inputValidator({ companyName: 500, industry: 500, monthlyVisitors: 500, monthlyLeads: 500, monthlySales: 500, monthlyRevenue: 500, marketingBudget: 500, businessGoal: 4_000, businessDescription: 4_000 }), validateAnalyticsOutput),
  content: adapter("content", "standardAiTasks", inputValidator({ prompt: 4_000, contentType: 500, tone: 500, audience: 500, length: 500, keywords: 500 }), validateContentOutput),
  logo: adapter("logo", "standardAiTasks", inputValidator({ companyName: 500, industry: 500, brandStyle: 500, logoIdea: 4_000 }), validateLogoOutput),
  "branding-context": Object.freeze({ moduleId: "branding-context", usageCategory: null, executionSupport: "local-only", validateInput: validateBrandingContextInput, validateOutput: validateBrandingContextOutput }),
  image: Object.freeze({
    moduleId: "image", usageCategory: "imageGenerations", executionSupport: "unsupported",
    validateInput: () => null, validateOutput: null,
    unsupportedReason: "Durable binary asset storage and references are not implemented.",
  }),
});

function adapter(
  moduleId: EasyModeModuleId,
  usageCategory: UsageCategory,
  validateInput: ModuleAdapter["validateInput"],
  validateOutput: ModuleOutputValidator,
): ModuleAdapter {
  return Object.freeze({ moduleId, usageCategory, executionSupport: "provider-disabled-phase-3a", validateInput, validateOutput });
}

export function getModuleAdapter(value: unknown): ModuleAdapter | null {
  return isEasyModePlannedModuleId(value) ? ADAPTERS[value] : null;
}

const BRANDING_CONTEXT_FIELDS = {
  businessName: 500, industry: 500, businessDescription: 4_000, targetAudience: 2_000,
  brandStyle: 2_000, brandVoice: 10_000, brandColors: 10_000, typography: 10_000,
} as const;

type BrandingContextSource = Readonly<Record<string, unknown>>;
export type BrandingContextInput = Readonly<{
  project: BrandingContextSource;
  memory?: BrandingContextSource | null;
  brandingOutput?: BrandingContextSource | null;
}>;

function validateBrandingContextInput(value: unknown): ModuleExecutionInput | null {
  if (!isRecord(value) || !exactKeys(value, ["project"], ["memory", "brandingOutput"]) || !isRecord(value.project)) return null;
  if (value.memory != null && !isRecord(value.memory)) return null;
  if (value.brandingOutput != null && !validateBrandingOutput(value.brandingOutput)) return null;
  return Object.freeze({ project: value.project, memory: value.memory ?? null, brandingOutput: value.brandingOutput ?? null });
}

function validateBrandingContextOutput(value: unknown) {
  return validateStringObject(value, { businessName: 500, industry: 500 }, {
    businessDescription: 4_000, targetAudience: 2_000, brandStyle: 2_000,
    brandVoice: 10_000, brandColors: 10_000, typography: 10_000,
  });
}

export function buildBrandingContext(value: unknown): NormalizedModuleOutput | null {
  const input = validateBrandingContextInput(value);
  if (!input) return null;
  const project = input.project as BrandingContextSource;
  const memory = (input.memory ?? {}) as BrandingContextSource;
  const branding = (input.brandingOutput ?? {}) as BrandingContextSource;
  const sources: Readonly<Record<string, readonly unknown[]>> = {
    businessName: [branding.brandName, memory.businessName, project.companyName, project.name],
    industry: [memory.industry, project.industry],
    businessDescription: [memory.businessDescription, project.businessDescription, project.originalBrief],
    targetAudience: [memory.targetAudience, project.targetAudience],
    brandStyle: [memory.brandStyle, project.brandStyle],
    brandVoice: [branding.brandVoice, memory.brandVoice],
    brandColors: [branding.colorPalette, memory.brandColors],
    typography: [branding.typography, memory.typography],
  };
  const output: Record<string, string> = {};
  for (const [field, candidates] of Object.entries(sources)) {
    const maximum = BRANDING_CONTEXT_FIELDS[field as keyof typeof BRANDING_CONTEXT_FIELDS];
    const selected = candidates.map((item) => safeString(item, maximum)).find(Boolean);
    if (selected) output[field] = selected;
  }
  return validateBrandingContextOutput(output);
}
