import type { BusinessAnalyticsMetrics } from "@/app/lib/analytics-metrics-calculation";
import { validateSalesOutput } from "@/app/lib/easy-mode-execution-contracts";
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
const DELIVERY_PROMISE = /\b(?:deliver(?:y)?|complete|ready|turnaround|timeline)[^.!?\n]{0,80}\b(?:within|in|takes?)\s*(?:\[[^\]]+\]|x|\d+(?:\s*[–—-]\s*\d+)?)\s*(?:hours?|days?|weeks?|months?)\b/i;
const CUSTOMER_PROOF = /\b(?:testimonials?|case stud(?:y|ies))\b/i;
const SCARCITY = /\b(?:limited (?:slots?|availability|time|capacity)|only \d+ (?:slots?|places?)|(?:\d+\s+)?slots? (?:left|available)|availability (?:this|next) (?:week|month)|book before|act now|last chance|selling fast)\b/i;
const PAYMENT_POLICY = /(?:\b\d+(?:\.\d+)?\s*%\s*(?:upfront|advance|deposit|balance|on (?:booking|completion))\b|\b(?:deposit|advance payment|payment milestones?|installments?|balance due)\b|\bsite visit[^.!?\n]{0,100}\b(?:credit|credited|refund|refundable|fee|payment|paid)\b|\b(?:credit|credited|refund|refundable|fee|payment|paid)[^.!?\n]{0,100}\bsite visit\b)/i;
const BOOKING_OPERATIONS = /\b(?:booking slots?|book (?:a|your) slot|reserve (?:a|your) slot|slot reservation|reservation (?:fee|policy)|booking checklist|site[- ]visit checklist|pre[- ]visit checklist)\b/i;
const NUMERIC_PRICING_UPLIFT = /(?:\+\s*)?\d+(?:\.\d+)?\s*(?:[–—-]\s*\d+(?:\.\d+)?\s*)?%/i;
const PIPELINE_PROMISE = /\b(?:pipeline lift|double (?:the )?pipeline|\d+x (?:the )?pipeline)\b/i;
const UNVERIFIED_UPSELL = /\b(?:upsell|cross[- ]sell|add[- ]on services?|referral commissions?|commission per referral)\b/i;
const SECONDARY_B2C = /\b(?:developers?|nris?|non[- ]resident indians?|b2b|commercial clients?|business clients?|builders?)\b/i;
const PARTNERSHIP = /\b(?:strategic |channel |vendor |financing |referral )?partnerships?|referral network|affiliate(?:s| program)?\b/i;
const TOOL_OR_SYSTEM = /\b(?:crm|salesforce|hubspot|calendly|booking system|lead[- ]scoring system|pipeline dashboard|proposal software|payment portal|automation|automated follow[- ]up)\b/i;
const CUSTOMER_PROMISE = /\b(?:unlimited revisions?|dedicated (?:manager|support)|24\s*\/\s*7|after[- ]sales support|money[- ]back|satisfaction|complimentary|free (?:audit|assessment|quote|design|consultation))\b/i;
const CHANNEL_ACTIVITY = /\b(?:meta|facebook|instagram|linkedin)\b[^.!?\n]{0,80}\b(?:is|are|was|were|has been|have been)\s+(?:already\s+)?(?:active|connected|posted|published|scheduled|running|launched)\b/i;
const UNVERIFIED_PERFORMANCE = /\b(?:strong|high|growing|improved|increased|proven|successful)\s+(?:revenue|sales|conversion|pipeline|demand|close rates?)|\b(?:boosts?|lifts?|grows?|increases?|improves?|increased|improved)\s+(?:revenue|sales|conversion|pipeline|close rates?)\b/i;
const OPTIONAL_LANGUAGE = /^\s*(?:consider|recommend|suggest|explore|optionally|if approved|when approved|confirm|validate|the business owner (?:may|could|should))\b/i;

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

function sanitizeSentence(sentence: string, context: SalesSafetyContext, corpus: string, key: string) {
  const verified = (pattern: RegExp) => pattern.test(corpus);
  if (CHANNEL_ACTIVITY.test(sentence)) return "No social-channel activity is verified in this Sales strategy.";
  if (context.channels.meta !== "connected" && /\b(?:meta|facebook|instagram)\b/i.test(sentence) && /\b(?:post|publish|schedule|launch|run|campaign|active|connected|use|outreach|message|dm|advertise)\b/i.test(sentence)) return "Consider Meta as an optional channel; connect Meta before publishing through Buzypeezy.";
  if (context.channels.linkedin !== "connected" && /\blinkedin\b/i.test(sentence) && /\b(?:post|publish|schedule|launch|run|campaign|active|connected|use|outreach|message|advertise)\b/i.test(sentence)) return "Consider LinkedIn as an optional channel; connect LinkedIn before publishing through Buzypeezy.";
  if (PAYMENT_POLICY.test(sentence)) return "Confirm all percentages, deposits, credits, and site-visit payment terms with the business owner.";
  if (key === "pricingRecommendations" && NUMERIC_PRICING_UPLIFT.test(sentence)) return "Treat pricing uplifts as optional hypotheses and confirm exact percentages with the business owner.";
  if (BOOKING_OPERATIONS.test(sentence) && !verified(BOOKING_OPERATIONS)) return "Consider a booking process or checklist only after the business owner approves the workflow.";
  if (PIPELINE_PROMISE.test(sentence)) return "Treat pipeline improvement as a planning goal, not a guaranteed outcome.";
  if (UNVERIFIED_UPSELL.test(sentence) && !verified(UNVERIFIED_UPSELL)) return "Consider add-on services or referral arrangements only when the business owner explicitly approves them.";
  if (PARTNERSHIP.test(sentence) && !verified(PARTNERSHIP)) return "Consider partnerships only after the business owner verifies and approves the relationship and terms.";
  if (TOOL_OR_SYSTEM.test(sentence) && !verified(TOOL_OR_SYSTEM)) return "Consider an optional sales tool or system only if the business owner chooses and configures it.";
  if (FINANCING.test(sentence) && !verified(FINANCING)) return "Consider financing partnerships only if the business owner establishes and approves them.";
  if (WARRANTY.test(sentence) && !verified(WARRANTY)) return "Consider a warranty only if its exact terms are approved by the business owner.";
  if (SITE_VISIT.test(sentence) && !verified(SITE_VISIT)) return "Consider offering site visits only if the business owner approves the availability and terms.";
  if (PROMOTION.test(sentence) && !verified(PROMOTION)) return "Consider a promotional offer only if the business owner approves its exact terms.";
  if (DELIVERY_PROMISE.test(sentence) && !corpus.includes(sentence.toLowerCase())) return "Confirm delivery timelines with the business owner before presenting them to customers.";
  if (CUSTOMER_PROOF.test(sentence) && !verified(CUSTOMER_PROOF)) return "Consider using approved testimonials or case studies when verified customer proof is available.";
  if (CUSTOMER_PROMISE.test(sentence) && !verified(CUSTOMER_PROMISE)) return "Consider this customer offer only if the business owner approves the exact promise and terms.";
  if (SCARCITY.test(sentence) && !verified(SCARCITY)) return "Use urgency only when current capacity or availability is verified by the business owner.";
  if (GUARANTEE.test(sentence)) return "Present guarantees only when exact approved terms exist in the saved business data.";
  if (PROJECTION.test(sentence) && QUANTIFIED.test(sentence)) return "Treat numerical targets as planning hypotheses, not verified outcomes.";
  if (PRICING.test(sentence) && QUANTIFIED.test(sentence)) return "Confirm pricing, discounts, and payment terms with the business owner.";
  if (MEASUREMENT.test(sentence) && QUANTIFIED.test(sentence) && !containsOnlyVerifiedNumbers(sentence, context.metrics)) return "Use only the verified enquiries, orders, and paid revenue shown in the connected business context.";
  if (UNVERIFIED_PERFORMANCE.test(sentence) && !corpus.includes(sentence.toLowerCase())) return "Treat performance improvement as a strategy objective, not a verified outcome.";
  if (PRICING.test(sentence) && !OPTIONAL_LANGUAGE.test(sentence) && !verified(PRICING)) return "Treat pricing, fees, discounts, and packages as optional until the business owner approves exact terms.";
  return sentence;
}

function sanitizeText(value: string, context: SalesSafetyContext, key: string) {
  const sentences = value.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const corpus = verifiedCorpus(context);
  const normalized = sentences.map((sentence) => sanitizeSentence(sentence, context, corpus, key));
  return [...new Set(normalized.map((sentence) => sentence.trim()).filter(Boolean))].join("\n").trim() || "Use the verified business context above; confirm commercial terms with the business owner.";
}

function alignHomeownerAudience(value: string) {
  const demoted = value.split("\n").map((line) => SECONDARY_B2C.test(line)
    ? `Potential secondary audience hypothesis (not the primary B2C customer): ${line}`
    : line).join("\n");
  return `Primary B2C customers: Homeowners. Other audience details are potential segments, not verified facts.\n${demoted}`;
}

export function sanitizeSalesInsights(value: unknown, source: BusinessAnalyticsMetrics | SalesSafetyContext): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const context = normalizeContext(source);
  const clean = (item: unknown, key = ""): unknown => {
    if (typeof item === "string") {
      const safe = sanitizeText(item, context, key);
      if (key === "targetCustomerProfile" && /\bhomeowners?\b/i.test(context.business.targetAudience ?? "") && !/^Primary B2C customers: Homeowners\./i.test(safe)) return alignHomeownerAudience(safe);
      return safe;
    }
    if (Array.isArray(item)) return item.map((nested) => clean(nested, key));
    return item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([nestedKey, nested]) => [nestedKey, clean(nested, nestedKey)])) : item;
  };
  return clean(value) as Record<string, unknown>;
}

export function validateSalesWebhookOutput(
  value: unknown,
  source: BusinessAnalyticsMetrics | SalesSafetyContext,
) {
  const raw = unwrapSalesProviderResponse(value);
  const validated = validateSalesOutput(raw);
  if (!validated) return null;
  const sanitized = sanitizeSalesInsights(validated, source);
  if (!sanitized) return null;
  return validateSalesOutput(sanitized);
}

export function readStoredSalesInsights(value: unknown, source: BusinessAnalyticsMetrics | SalesSafetyContext) {
  const parsed = unwrapSalesProviderResponse(value);
  return sanitizeSalesInsights(parsed, source);
}
