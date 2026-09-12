import "server-only";

import { validateSeoOutput } from "@/app/lib/easy-mode-execution-contracts";
import { normalizeSeoOpportunities } from "@/app/lib/seo-opportunity-safety";
import { validateWrappedWebhookOutput } from "@/app/lib/specialist-execution";

const SEO_REQUIRED_FIELDS = [
  "seoAudit",
  "keywords",
  "metaTitles",
  "metaDescriptions",
  "internalLinking",
  "blogTopics",
  "technicalSEO",
  "kpis",
  "growthRecommendations",
] as const;

const SEO_ALLOWED_FIELDS = new Set([
  ...SEO_REQUIRED_FIELDS,
  "colourScheme",
  "designRecommendations",
  "keywordResearch",
  "recommendedPages",
  "seoContentPlan",
  "seoScore",
  "seoStrategy",
  "siteStructure",
  "typography",
  "websiteFeatures",
]);

function safeSeoField(value: unknown, normalizedValue: unknown, fallback: string) {
  const text = typeof value === "string"
    ? value.trim()
    : typeof normalizedValue === "string"
      ? normalizedValue.trim()
      : "";
  return text || fallback;
}

function recognizedSeoRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => SEO_ALLOWED_FIELDS.has(key)) ? record : null;
}

function nonEmptySeoSignalCount(value: Record<string, unknown>) {
  return [
    "seoAudit",
    "keywords",
    "metaTitles",
    "metaDescriptions",
    "internalLinking",
    "blogTopics",
    "technicalSEO",
    "growthRecommendations",
    "keywordResearch",
    "seoStrategy",
    "seoContentPlan",
  ].reduce((count, key) => count + (typeof value[key] === "string" && value[key].trim() ? 1 : 0), 0);
}

function buildCanonicalSeoOutput(value: Record<string, unknown>, approvedFacts: unknown) {
  const normalized = normalizeSeoOpportunities(value, approvedFacts);
  const candidate = {
    seoAudit: safeSeoField(
      normalized.seoAudit ?? value.seoAudit,
      normalized.seoAudit ?? normalized.seoStrategy ?? normalized.technicalSEO ?? normalized.growthRecommendations ?? value.seoStrategy,
      "Use verified business details and published-page facts to guide SEO recommendations.",
    ),
    keywords: safeSeoField(
      normalized.keywords ?? value.keywords,
      normalized.keywords ?? normalized.keywordResearch ?? value.keywordResearch,
      "Focus keyword themes on verified services, locations, and customer questions.",
    ),
    metaTitles: safeSeoField(
      normalized.metaTitles ?? value.metaTitles,
      normalized.metaTitles,
      "Draft factual page titles using verified business, service, and location language.",
    ),
    metaDescriptions: safeSeoField(
      normalized.metaDescriptions ?? value.metaDescriptions,
      normalized.metaDescriptions,
      "Write concise meta descriptions based on verified customer needs and services.",
    ),
    internalLinking: safeSeoField(
      normalized.internalLinking ?? value.internalLinking,
      normalized.internalLinking,
      "Link key service and contact pages with clear, verified customer-language anchors.",
    ),
    blogTopics: safeSeoField(
      normalized.blogTopics ?? value.blogTopics,
      normalized.blogTopics ?? normalized.seoContentPlan ?? value.seoContentPlan,
      "Plan educational topics that answer verified customer questions about the business offer.",
    ),
    technicalSEO: safeSeoField(
      normalized.technicalSEO ?? value.technicalSEO,
      normalized.technicalSEO,
      "Prioritize crawlable page structure, descriptive metadata, and implementation checks on the published website.",
    ),
    kpis: safeSeoField(
      normalized.kpis ?? value.kpis,
      normalized.kpis,
      "Track only verified search performance data after approved analytics or search tools are connected.",
    ),
    growthRecommendations: safeSeoField(
      normalized.growthRecommendations ?? value.growthRecommendations,
      normalized.growthRecommendations ?? normalized.recommendedPages ?? value.recommendedPages,
      "Improve search visibility with verified service language, page coverage, and owner-approved content updates.",
    ),
  };
  return validateSeoOutput(candidate);
}

export function validateSeoWebhookOutput(value: unknown, approvedFacts: unknown = null) {
  return validateWrappedWebhookOutput(value, (candidate) => {
    const validated = validateSeoOutput(candidate);
    if (validated) {
      const canonical = buildCanonicalSeoOutput(validated, approvedFacts);
      return canonical ? validateSeoOutput(canonical) : null;
    }
    const record = recognizedSeoRecord(candidate);
    if (!record || nonEmptySeoSignalCount(record) < 3) return null;
    return buildCanonicalSeoOutput(record, approvedFacts);
  });
}
