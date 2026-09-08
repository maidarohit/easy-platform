const UNSUPPORTED_CLAIM = /\b(?:affordable|cheapest|free consultations?|free estimates?|guaranteed|award[- ]winning|transparent pricing|on[- ]time delivery|years? of experience|certifications?|reviews?|case stud(?:y|ies))\b/i;
const UNSUPPORTED_TECH = /\b(?:wordpress|switch (?:your )?hosting|hosting-provider switch|cloudflare|bunnycdn|\bFID\b|meta keywords?|keyword density)\b/i;
const FABRICATED_METRIC = /\b(?:search volume|keyword difficulty|domain authority|rank(?:ing)? (?:prediction|forecast)|traffic (?:growth|forecast)|\d+(?:\.\d+)?% (?:traffic|ranking|growth|increase))\b/i;

function safeText(value: string, approvedText: string) {
  return value.split(/(?<=[.!?])\s+|\r?\n/).map((part) => part.trim())
    .filter((part) => {
      const claim = part.match(UNSUPPORTED_CLAIM)?.[0]?.toLowerCase();
      return part && (!claim || approvedText.includes(claim)) && !UNSUPPORTED_TECH.test(part) && !FABRICATED_METRIC.test(part);
    })
    .join("\n");
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
      if ("text" in wrapped && (typeof wrapped.text === "string" || (wrapped.text && typeof wrapped.text === "object"))) { value = wrapped.text; continue; }
    }
    break;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const blockedFields = new Set(["seoScore", "score", "kpis", "seoAudit"]);
  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (blockedFields.has(key)) continue;
    if (typeof item === "string") normalized[key] = safeText(item, approvedText);
    else if (Array.isArray(item)) normalized[key] = item.filter((entry): entry is string => typeof entry === "string").map((entry) => safeText(entry, approvedText)).filter(Boolean);
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

export function findLatestValidSeoOutput<T extends Readonly<{ result: unknown }>>(orderedCandidates: readonly T[]): T | undefined {
  return orderedCandidates.find((candidate) => readStoredSeoOpportunities(candidate.result));
}
