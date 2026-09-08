import type { BusinessAnalyticsMetrics } from "@/app/lib/analytics-metrics-calculation";
import { unwrapSalesProviderResponse } from "@/app/lib/sales-provider-response";

const GUARANTEE = /\b(?:guarantee|guaranteed|risk[- ]free|will definitely|assured)\b/i;
const PROJECTION = /\b(?:target|project(?:ed|ion)?|forecast|expect(?:ed)?|will (?:reach|generate|increase|grow)|increase by|grow by)\b/i;
const PRICING = /\b(?:price|pricing|fee|package|retainer|budget|discount)\b/i;
const MEASUREMENT = /\b(?:revenue|sales|orders?|leads?|enquir(?:y|ies)|conversion(?: rate)?)\b/i;
const QUANTIFIED = /(?:\d|%|\u20b9|\binr\b|\brs\.?\b|\$)/i;
const FINANCING = /\bfinanc(?:e|ing|ial)(?: partnerships?| options?| plans?)?\b/i;
const WARRANTY = /\b(?:warranty|warranties)\b/i;
const SITE_VISIT = /\b(?:free|paid)?\s*site visits?\b/i;
const PROMOTION = /\b(?:discounts?|incentives?|special offers?|free consultation)\b/i;
const DELIVERY_PROMISE = /\b(?:deliver(?:y)?|complete|ready|turnaround)[^.!?\n]{0,60}\b(?:within|in)\s+\d+\s*(?:hours?|days?|weeks?|months?)\b/i;
const CUSTOMER_PROOF = /\b(?:testimonials?|case stud(?:y|ies))\b/i;
const SCARCITY = /\b(?:limited (?:slots?|availability|time)|only \d+ (?:slots?|places?)|act now|last chance|selling fast)\b/i;

type SalesSafetyContext = {
  metrics: BusinessAnalyticsMetrics;
  business: { description: string | null; targetAudience: string | null; services: string[] };
  channels: { meta: "connected" | "not_connected"; linkedin: "connected" | "not_connected"; whatsapp: "approved_contact" | "not_connected" };
};

function normalizeContext(value: BusinessAnalyticsMetrics | SalesSafetyContext): SalesSafetyContext {
  return "metrics" in value ? value : {
    metrics: value,
    business: { description: null, targetAudience: null, services: [] },
    channels: { meta: "not_connected", linkedin: "not_connected", whatsapp: "not_connected" },
  };
}

function verifiedCorpus(context: SalesSafetyContext) {
  return [context.business.description, context.business.targetAudience, ...context.business.services].filter(Boolean).join(" ").toLowerCase();
}

function containsOnlyVerifiedNumbers(text: string, metrics: BusinessAnalyticsMetrics) {
  const allowed = new Set<string>();
  if (/\brevenue\b/i.test(text)) {
    allowed.add(String(metrics.paidRevenuePaise));
    allowed.add(String(metrics.paidRevenuePaise / 100));
    allowed.add((metrics.paidRevenuePaise / 100).toLocaleString("en-IN"));
  }
  if (/\bconversion(?: rate)?\b/i.test(text) && metrics.enquiryToPaidOrderRate !== null) allowed.add(String(metrics.enquiryToPaidOrderRate));
  if (/\b(?:leads?|enquir(?:y|ies))\b/i.test(text)) allowed.add(String(metrics.enquiries));
  if (/\bpaid orders?\b/i.test(text)) allowed.add(String(metrics.paidOrders));
  else if (/\bfulfilled orders?\b/i.test(text)) allowed.add(String(metrics.fulfilledOrders));
  else if (/\borders?\b/i.test(text)) allowed.add(String(metrics.orders));
  if (/\bsales\b/i.test(text)) allowed.add(String(metrics.paidOrders));
  const numbers = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return numbers.length > 0 && numbers.every((number) => allowed.has(number.replace(/,/g, "")) || allowed.has(number));
}

function sanitizeSentence(sentence: string, context: SalesSafetyContext, corpus: string) {
  const verified = (pattern: RegExp) => pattern.test(corpus);
  if (context.channels.meta !== "connected" && /\b(?:meta|facebook|instagram)\b/i.test(sentence) && /\b(?:post|publish|schedule|launch|run|campaign|active|connected)\b/i.test(sentence)) return "Consider Meta as an optional channel; connect Meta before publishing through Buzypeezy.";
  if (context.channels.linkedin !== "connected" && /\blinkedin\b/i.test(sentence) && /\b(?:post|publish|schedule|launch|run|campaign|active|connected)\b/i.test(sentence)) return "Consider LinkedIn as an optional channel; connect LinkedIn before publishing through Buzypeezy.";
  if (FINANCING.test(sentence) && !verified(FINANCING)) return "Consider financing partnerships only if the business owner establishes and approves them.";
  if (WARRANTY.test(sentence) && !verified(WARRANTY)) return "Consider a warranty only if its exact terms are approved by the business owner.";
  if (SITE_VISIT.test(sentence) && !verified(SITE_VISIT)) return "Consider offering site visits only if the business owner approves the availability and terms.";
  if (PROMOTION.test(sentence) && !verified(PROMOTION)) return "Consider a promotional offer only if the business owner approves its exact terms.";
  if (DELIVERY_PROMISE.test(sentence) && !corpus.includes(sentence.toLowerCase())) return "Confirm delivery timelines with the business owner before presenting them to customers.";
  if (CUSTOMER_PROOF.test(sentence) && !verified(CUSTOMER_PROOF)) return "Consider using approved testimonials or case studies when verified customer proof is available.";
  if (SCARCITY.test(sentence) && !verified(SCARCITY)) return "Use urgency only when current capacity or availability is verified by the business owner.";
  if (GUARANTEE.test(sentence)) return "Present guarantees only when exact approved terms exist in the saved business data.";
  if (PROJECTION.test(sentence) && QUANTIFIED.test(sentence)) return "Treat numerical targets as planning hypotheses, not verified outcomes.";
  if (PRICING.test(sentence) && QUANTIFIED.test(sentence)) return "Confirm pricing, discounts, and payment terms with the business owner.";
  if (MEASUREMENT.test(sentence) && QUANTIFIED.test(sentence) && !containsOnlyVerifiedNumbers(sentence, context.metrics)) return "Use only the verified enquiries, orders, and paid revenue shown in the connected business context.";
  return sentence;
}

function sanitizeText(value: string, context: SalesSafetyContext) {
  const sentences = value.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const corpus = verifiedCorpus(context);
  return sentences.map((sentence) => sanitizeSentence(sentence, context, corpus)).join("\n").trim() || "Use the verified business context above; confirm commercial terms with the business owner.";
}

export function sanitizeSalesInsights(value: unknown, source: BusinessAnalyticsMetrics | SalesSafetyContext): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const context = normalizeContext(source);
  const clean = (item: unknown, key = ""): unknown => {
    if (typeof item === "string") {
      const safe = sanitizeText(item, context);
      if (key === "targetCustomerProfile" && /\bhomeowners?\b/i.test(context.business.targetAudience ?? "") && !/^Primary B2C customers: Homeowners\./i.test(safe)) return `Primary B2C customers: Homeowners. Other audience details are potential segments, not verified facts.\n${safe}`;
      return safe;
    }
    if (Array.isArray(item)) return item.map((nested) => clean(nested, key));
    return item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([nestedKey, nested]) => [nestedKey, clean(nested, nestedKey)])) : item;
  };
  return clean(value) as Record<string, unknown>;
}

export function readStoredSalesInsights(value: unknown, source: BusinessAnalyticsMetrics | SalesSafetyContext) {
  const parsed = unwrapSalesProviderResponse(value);
  return sanitizeSalesInsights(parsed, source);
}
