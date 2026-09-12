import { validateSeoOutput } from "@/app/lib/easy-mode-execution-contracts";
import { validateWrappedWebhookOutput } from "@/app/lib/specialist-execution";

const UNSUPPORTED_CLAIM = /\b(?:affordable|cheapest|free consultations?|free estimates?|guaranteed|award[- ]winning|transparent pricing|on[- ]time delivery|years? of experience|certifications?|reviews?|case stud(?:y|ies))\b/i;
const UNSUPPORTED_TECH = /\b(?:wordpress|switch (?:your )?hosting|hosting-provider switch|cloudflare|bunnycdn|\bFID\b|meta keywords?|keyword density)\b/i;
const FABRICATED_METRIC = /\b(?:search volume|keyword difficulty|domain authority|rank(?:ing)? (?:prediction|forecast)|traffic (?:growth|forecast)|(?:traffic|ranking|growth|increase)[^.!?\n]{0,40}\d+(?:\.\d+)?%|\d+(?:\.\d+)?%[^.!?\n]{0,40}(?:traffic|ranking|growth|increase))/i;
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

function approvedPlaceholderValues(approvedFacts: unknown) {
  const facts = approvedFacts && typeof approvedFacts === "object" && !Array.isArray(approvedFacts)
    ? approvedFacts as Record<string, unknown> : {};
  const location = typeof facts.location === "string" ? facts.location.trim() : "";
  const services = Array.isArray(facts.services)
    ? facts.services.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : typeof facts.services === "string" && facts.services.trim() ? [facts.services.trim()] : [];
  return {
    city: location.split(",")[0]?.trim() || "",
    location,
    service: services[0]?.trim() || "",
    business: typeof facts.businessName === "string" ? facts.businessName.trim() : "",
    businessname: typeof facts.businessName === "string" ? facts.businessName.trim() : "",
    industry: typeof facts.industry === "string" ? facts.industry.trim() : "",
  };
}

const PLACEHOLDER = /(?:\[+|\{+|<)\s*([a-z][a-z0-9 _-]{0,40})\s*(?:\]+|\}+|>)/gi;

export function resolveSeoOpportunityPlaceholders(value: string, approvedFacts: unknown = null) {
  const verified = approvedPlaceholderValues(approvedFacts);
  const resolved = value.replace(PLACEHOLDER, (placeholder, rawKey: string, offset: number, source: string) => {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const replacement = verified[key as keyof typeof verified] || "";
    if (replacement) return replacement;
    const prefix = source.slice(0, offset);
    return /\b(?:in|near|around|serving)\s*$/i.test(prefix) ? "\u0000" : "";
  }).replace(/\b(?:in|near|around|serving)\s*\u0000/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:])\s*([,.;:!?])/g, "$2")
    .replace(/\s{2,}/g, " ").trim();
  return resolved.replace(/^[,;:\s]+|[,;:\s]+$/g, "");
}

function safeText(value: string, approvedText: string, approvedFacts: unknown) {
  return resolveSeoOpportunityPlaceholders(value, approvedFacts).split(/(?<=[.!?])\s+|\r?\n/).map((part) => part.trim())
    .filter((part) => {
      const claim = part.match(UNSUPPORTED_CLAIM)?.[0]?.toLowerCase();
      return part && (!claim || approvedText.includes(claim)) && !UNSUPPORTED_TECH.test(part) && !FABRICATED_METRIC.test(part);
    })
    .join("\n");
}

function safeSeoField(value: unknown, approvedFacts: unknown, fallback: string) {
  const text = typeof value === "string" ? safeText(value, JSON.stringify(approvedFacts).toLowerCase(), approvedFacts).trim() : "";
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
    seoAudit: safeSeoField(value.seoAudit ?? value.seoStrategy ?? normalized.technicalSEO ?? normalized.growthRecommendations, approvedFacts,
      "Use verified business details and published-page facts to guide SEO recommendations."),
    keywords: safeSeoField(value.keywords ?? value.keywordResearch ?? normalized.keywordResearch, approvedFacts,
      "Focus keyword themes on verified services, locations, and customer questions."),
    metaTitles: safeSeoField(value.metaTitles ?? normalized.metaTitles, approvedFacts,
      "Draft factual page titles using verified business, service, and location language."),
    metaDescriptions: safeSeoField(value.metaDescriptions ?? normalized.metaDescriptions, approvedFacts,
      "Write concise meta descriptions based on verified customer needs and services."),
    internalLinking: safeSeoField(value.internalLinking ?? normalized.internalLinking, approvedFacts,
      "Link key service and contact pages with clear, verified customer-language anchors."),
    blogTopics: safeSeoField(value.blogTopics ?? value.seoContentPlan ?? normalized.blogTopics, approvedFacts,
      "Plan educational topics that answer verified customer questions about the business offer."),
    technicalSEO: safeSeoField(value.technicalSEO ?? normalized.technicalSEO, approvedFacts,
      "Prioritize crawlable page structure, descriptive metadata, and implementation checks on the published website."),
    kpis: safeSeoField(value.kpis, approvedFacts,
      "Track only verified search performance data after approved analytics or search tools are connected."),
    growthRecommendations: safeSeoField(value.growthRecommendations ?? normalized.growthRecommendations ?? value.recommendedPages, approvedFacts,
      "Improve search visibility with verified service language, page coverage, and owner-approved content updates."),
  };
  return validateSeoOutput(candidate);
}

export function normalizeSeoOpportunities(value: unknown, approvedFacts: unknown = null): Record<string, unknown> {
  const approvedText = JSON.stringify(approvedFacts).toLowerCase();
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { return {}; }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const wrapped = value as Record<string, unknown>;
      if ("output" in wrapped) { value = wrapped.output; continue; }
      if ("result" in wrapped) { value = wrapped.result; continue; }
      if ("response" in wrapped) { value = wrapped.response; continue; }
      if ("data" in wrapped) { value = wrapped.data; continue; }
      if ("body" in wrapped) { value = wrapped.body; continue; }
      if ("json" in wrapped) { value = wrapped.json; continue; }
      if ("text" in wrapped && (typeof wrapped.text === "string" || (wrapped.text && typeof wrapped.text === "object"))) { value = wrapped.text; continue; }
    }
    break;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const blockedFields = new Set(["seoScore", "score", "kpis", "seoAudit"]);
  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (blockedFields.has(key)) continue;
    if (typeof item === "string") normalized[key] = safeText(item, approvedText, approvedFacts);
    else if (Array.isArray(item)) normalized[key] = item.filter((entry): entry is string => typeof entry === "string").map((entry) => safeText(entry, approvedText, approvedFacts)).filter(Boolean);
  }
  return normalized;
}

export const SEO_GROUNDING_RULES = [
  "Use only the verified facts supplied in publicationContext.",
  "Treat missing facts as unknown; never invent claims, locations, credentials, reviews, prices, results, or case studies.",
  "Return opportunities, not measured rankings, search volume, keyword difficulty, traffic forecasts, or guarantees.",
  "Do not recommend WordPress, hosting changes, Cloudflare, BunnyCDN, FID, meta keywords, or keyword density.",
  "LCP, INP, and CLS are not measured and must not be described as passing or failing.",
] as const;

export function readStoredSeoOpportunities(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidate = record.seoOpportunities && typeof record.seoOpportunities === "object" && !Array.isArray(record.seoOpportunities)
    ? record.seoOpportunities
    : record;
  const normalized = normalizeSeoOpportunities(candidate);
  return Object.values(normalized).some((item) => typeof item === "string" ? item.trim() : Array.isArray(item) && item.length > 0)
    ? normalized
    : null;
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

export function findLatestValidSeoOutput<T extends Readonly<{ result: unknown }>>(orderedCandidates: readonly T[]): T | undefined {
  return orderedCandidates.find((candidate) => readStoredSeoOpportunities(candidate.result));
}
