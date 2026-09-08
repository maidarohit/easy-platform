import type { MarketingBusinessContext } from "@/app/lib/marketing-business-context";

const URL = /https?:\/\/[^\s)\]}]+/gi;
const PLACEHOLDER = /\[[a-z][a-z0-9 _-]{0,30}\]/gi;
const UNSUPPORTED_OUTPUT_KEY = /^(marketingDashboard|marketingScore)$/i;
const UNSUPPORTED_PERFORMANCE = /\b(highest roi|high[- ]conversion|cpl reduction|traffic growth|conversion improvement|campaign roi|marketing roi|customer acquisition cost|cac)\b/i;
const NUMERIC_TARGET = /(?:\b(?:increase|grow|boost|improve|target|reach|conversion|leads?)\b[^.!?\n]{0,70}(?:\d+(?:\.\d+)?\s*%|\d+\s*(?:leads?|sales?|customers?)\s*\/\s*(?:month|week|day)))/i;
const FINANCIAL_ASSUMPTION = /(?:[$₹]\s*[\d,]+|\b(?:usd|inr|rs\.?)\s*[\d,]+|\b\d+(?:\.\d+)?\s*%\s*(?:to|for|on|toward|towards|allocation)|\b(?:cpl|cost per lead)\b[^.!?\n]*[$₹\d])/i;
const DEMOGRAPHIC_ASSUMPTION = /\b(?:ages?\s*\d+\s*(?:-|–|to)\s*\d+|\d+\s*(?:-|–|to)\s*\d+\s*years? old|high[- ]net[- ]worth|income (?:band|segment)|project[- ]value band)\b/i;
const OFFER_TERMS = ["within 48 hours", "discount", "guarantee", "years of experience", "pricing", "price"] as const;
const ASSERTED_ASSET = /\b(crm|renovation budget planner|newsletter|google analytics|gtm|testimonials?|case studies|notion|airtable|client portal)\b/i;

function verifiedCorpus(context: MarketingBusinessContext) {
  return [context.business.name, context.business.industry, context.business.location, context.business.description, context.business.targetAudience, ...context.business.services]
    .filter((item): item is string => Boolean(item)).join(" ").toLowerCase();
}

function normalizePlaceholders(value: string, context: MarketingBusinessContext) {
  const location = context.business.location?.trim() || "";
  const service = context.business.services[0]?.trim() || "";
  return value.replace(PLACEHOLDER, (token) => /city|location/i.test(token) ? location : /service/i.test(token) ? service : /business|company|brand/i.test(token) ? context.business.name : "")
    .replace(/\b(?:in|at|near|for)\s+(?=[,.;:!?]|$)/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

function assetRecommendation(sentence: string) {
  const recommendations: string[] = [];
  if (/\bcrm\b/i.test(sentence)) recommendations.push("Consider an optional CRM if customer-management needs require one.");
  if (/renovation budget planner/i.test(sentence)) recommendations.push("Consider creating a budget-planning resource if it would help customers.");
  if (/newsletter/i.test(sentence)) recommendations.push("Consider creating a newsletter before planning newsletter campaigns.");
  if (/google analytics|\bgtm\b/i.test(sentence)) recommendations.push("Consider connecting an optional analytics tool before measuring website performance.");
  if (/testimonials?|case studies/i.test(sentence)) recommendations.push("Consider creating approved customer proof before using testimonials or case studies.");
  if (/notion|airtable|client portal/i.test(sentence)) recommendations.push("Consider an optional client-portal tool only if that capability is needed.");
  return recommendations.join(" ");
}

function cleanSentence(sentence: string, context: MarketingBusinessContext, corpus: string) {
  const text = sentence.trim();
  if (!text) return "";
  if (/\b(wordpress|webflow)\b/i.test(text)) return "Continue using the Buzypeezy website; an external CMS replacement is not required.";
  const channelMentioned = /\b(meta|facebook|instagram|linkedin)\b/i.test(text);
  if (channelMentioned && /\b(?:was|were|is|are|has been|have been)\s+(?:posted|published|scheduled|launched|running)\b/i.test(text)) return "No channel publishing activity is verified in this Marketing strategy.";
  if (context.channels.meta !== "connected" && /\b(meta|facebook|instagram)\b/i.test(text) && /\b(post|posted|publish|published|schedule|scheduled|launch|run|running|campaign|connected)\b/i.test(text)) return "Recommended channel — connect Meta to publish through Buzypeezy.";
  if (context.channels.linkedin !== "connected" && /\blinkedin\b/i.test(text) && /\b(post|posted|publish|published|schedule|scheduled|launch|run|running|campaign|connected)\b/i.test(text)) return "Recommended channel — connect LinkedIn to publish through Buzypeezy.";
  if (UNSUPPORTED_PERFORMANCE.test(text) || NUMERIC_TARGET.test(text) || FINANCIAL_ASSUMPTION.test(text)) return "";
  const demographic = text.match(DEMOGRAPHIC_ASSUMPTION)?.[0]?.toLowerCase();
  if (demographic && !corpus.includes(demographic)) return "";
  const freeOffer = text.match(/\bfree\s+[a-z0-9]+(?:\s+[a-z0-9]+){0,2}/i)?.[0]?.toLowerCase();
  if (freeOffer && !corpus.includes(freeOffer)) return "";
  const unsupportedOffer = OFFER_TERMS.find((term) => text.toLowerCase().includes(term) && !corpus.includes(term));
  if (unsupportedOffer) return "";
  const asset = text.match(ASSERTED_ASSET)?.[0]?.toLowerCase();
  if (asset && !corpus.includes(asset)) return assetRecommendation(text);
  return text;
}

function cleanText(value: string, context: MarketingBusinessContext) {
  const allowedUrl = context.website.url;
  const urlSafe = value.replace(URL, (url) => allowedUrl && url.replace(/[.,;:]$/, "") === allowedUrl ? allowedUrl : allowedUrl || "the website after it is published");
  const normalized = normalizePlaceholders(urlSafe, context);
  const corpus = verifiedCorpus(context);
  const lines = normalized.split(/\r?\n/).map((line) => line.split(/(?<=[.!?])\s+/).map((sentence) => cleanSentence(sentence, context, corpus)).filter(Boolean).join(" ")).filter(Boolean);
  return lines.join("\n").trim() || "Use only the verified business context and connected channels shown above.";
}

export function sanitizeMarketingInsights(value: unknown, context: MarketingBusinessContext): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean = (item: unknown): unknown => typeof item === "string" ? cleanText(item, context)
    : Array.isArray(item) ? item.map(clean)
      : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).filter(([key]) => !UNSUPPORTED_OUTPUT_KEY.test(key)).map(([key, nested]) => [key, clean(nested)])) : item;
  return clean(value) as Record<string, unknown>;
}

export function readStoredMarketingInsights(value: unknown, context: MarketingBusinessContext) {
  try { return sanitizeMarketingInsights(typeof value === "string" ? JSON.parse(value) : value, context); }
  catch { return null; }
}
