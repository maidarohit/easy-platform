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
const COMPLETED_WORK = /\b(?:we|our team)\s+(?:transformed|completed|delivered|created|built|renovated|designed)\b/i;
const CLIENT_RESULT = /\bour clients?\s+(?:achieved|increased|improved|saved|grew|generated)\b/i;
const PAST_CHANNEL_ACTIVITY = /\b(?:was|were|is|are|has been|have been)\s+(?:posted|published|scheduled|launched|running)\b/i;
const CHANNEL_EXECUTION = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|carousel|reel|story|post|publish|schedule|launch|run|campaign)\b/i;

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

function recommendedChannelContent(sentence: string, channel: "Meta" | "LinkedIn") {
  if (PAST_CHANNEL_ACTIVITY.test(sentence)) return `Recommended channel — connect ${channel} before publishing through Buzypeezy.`;
  const content = sentence.replace(/^\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:\s*/i, "")
    .replace(/^\s*(?:publish|post|schedule|launch|run)\s+/i, "")
    .replace(/^\s*on\s+(?:meta|facebook|instagram|linkedin)\s*[.:—-]*\s*/i, "")
    .trim();
  const recommendation = content ? `Recommended ${channel} content: ${content}` : `Recommended ${channel} content`;
  return `${recommendation} — connect ${channel} before publishing through Buzypeezy.`;
}

function cleanSentence(sentence: string, context: MarketingBusinessContext, corpus: string) {
  const text = sentence.trim();
  if (!text) return "";
  if (/\b(wordpress|webflow)\b/i.test(text)) return "Continue using the Buzypeezy website; an external CMS replacement is not required.";
  if (context.channels.meta !== "connected" && /\b(meta|facebook|instagram)\b/i.test(text) && (CHANNEL_EXECUTION.test(text) || /\bconnected\b/i.test(text))) return recommendedChannelContent(text, "Meta");
  if (context.channels.linkedin !== "connected" && /\blinkedin\b/i.test(text) && (CHANNEL_EXECUTION.test(text) || /\bconnected\b/i.test(text))) return recommendedChannelContent(text, "LinkedIn");
  if (/\b(meta|facebook|instagram|linkedin)\b/i.test(text) && PAST_CHANNEL_ACTIVITY.test(text)) return "No channel publishing activity is verified in this Marketing strategy.";
  if (COMPLETED_WORK.test(text) && !corpus.includes(text.toLowerCase())) return "Show an approved before-and-after project example when verified project imagery is available.";
  if (CLIENT_RESULT.test(text) && !corpus.includes(text.toLowerCase())) return "Consider sharing an approved customer result when verified evidence is available.";
  if (/\bbook\s+(?:a\s+)?site visit\b/i.test(text) && !corpus.includes("site visit")) return "Get in touch to discuss your project.";
  if (/\b(?:book|get|claim|request)\s+(?:a\s+)?free\b/i.test(text) && !corpus.includes(text.toLowerCase())) return "Get in touch to discuss your project.";
  if (/\b(?:deliver|delivery|turnaround|ready|complete)[^.!?\n]{0,50}\bwithin\s+\d+\s*(?:hours?|days?|weeks?)\b/i.test(text) && !corpus.includes(text.toLowerCase())) return "";
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

function labelAudienceHypotheses(value: string) {
  if (/potential audience segments|recommendations, not measured facts/i.test(value)) return value;
  return `Potential audience segments and suggested motivations (recommendations, not measured facts):\n${value}`;
}

export function sanitizeMarketingInsights(value: unknown, context: MarketingBusinessContext): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean = (item: unknown, key = ""): unknown => typeof item === "string" ? (key === "targetAudienceAnalysis" ? labelAudienceHypotheses(cleanText(item, context)) : cleanText(item, context))
    : Array.isArray(item) ? item.map((nested) => clean(nested, key))
      : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).filter(([nestedKey]) => !UNSUPPORTED_OUTPUT_KEY.test(nestedKey)).map(([nestedKey, nested]) => [nestedKey, clean(nested, nestedKey)])) : item;
  return clean(value) as Record<string, unknown>;
}

export function readStoredMarketingInsights(value: unknown, context: MarketingBusinessContext) {
  try { return sanitizeMarketingInsights(typeof value === "string" ? JSON.parse(value) : value, context); }
  catch { return null; }
}
