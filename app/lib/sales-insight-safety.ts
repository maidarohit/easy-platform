import type { BusinessAnalyticsMetrics } from "@/app/lib/analytics-metrics-calculation";
import { unwrapSalesProviderResponse } from "@/app/lib/sales-provider-response";

const GUARANTEE = /\b(?:guarantee|guaranteed|risk[- ]free|will definitely|assured)\b/i;
const PROJECTION = /\b(?:target|project(?:ed|ion)?|forecast|expect(?:ed)?|will (?:reach|generate|increase|grow)|increase by|grow by)\b/i;
const PRICING = /\b(?:price|pricing|fee|package|retainer|budget|discount)\b/i;
const MEASUREMENT = /\b(?:revenue|sales|orders?|leads?|enquir(?:y|ies)|conversion(?: rate)?)\b/i;
const QUANTIFIED = /(?:\d|%|₹|\binr\b|\brs\.?\b|\$)/i;

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

function sanitizeText(value: string, metrics: BusinessAnalyticsMetrics) {
  const sentences = value.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const safe = sentences.filter((sentence) => {
    if (GUARANTEE.test(sentence)) return false;
    if (PROJECTION.test(sentence) && QUANTIFIED.test(sentence)) return false;
    if (PRICING.test(sentence) && QUANTIFIED.test(sentence)) return false;
    if (MEASUREMENT.test(sentence) && QUANTIFIED.test(sentence) && !containsOnlyVerifiedNumbers(sentence, metrics)) return false;
    return true;
  });
  return safe.join("\n").trim() || "Use the verified business context above; confirm commercial terms with the business owner.";
}

export function sanitizeSalesInsights(value: unknown, metrics: BusinessAnalyticsMetrics): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean = (item: unknown): unknown => typeof item === "string" ? sanitizeText(item, metrics)
    : Array.isArray(item) ? item.map(clean)
      : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, clean(nested)])) : item;
  return clean(value) as Record<string, unknown>;
}

export function readStoredSalesInsights(value: unknown, metrics: BusinessAnalyticsMetrics) {
  const parsed = unwrapSalesProviderResponse(value);
  return sanitizeSalesInsights(parsed, metrics);
}
