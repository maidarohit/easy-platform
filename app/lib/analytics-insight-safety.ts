import { validateAnalyticsOutput } from "@/app/lib/easy-mode-execution-contracts";
import { validateWrappedWebhookOutput } from "@/app/lib/specialist-execution";

const UNSUPPORTED_MEASUREMENT = /\b(visitor|traffic\b.*\bgrow|traffic growth|conversion improvement|revenue growth|campaign roi|marketing roi|customer acquisition cost|cac|projection|forecast)\b/i;
const QUANTIFIED_CLAIM = /(?:\d|%|\u20b9|\binr\b|\brs\.?\b)/i;

function sanitizeText(value: string) {
  const kept = value.split(/(?<=[.!?])\s+/).filter((sentence) =>
    !(UNSUPPORTED_MEASUREMENT.test(sentence) && QUANTIFIED_CLAIM.test(sentence))
  );
  const result = kept.join(" ").trim();
  return result || "This metric is not currently measured by Buzypeezy.";
}

export function sanitizeAnalyticsInsights(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sanitize = (item: unknown): unknown => {
    if (typeof item === "string") return sanitizeText(item);
    if (Array.isArray(item)) return item.map(sanitize);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, sanitize(nested)]));
    return item;
  };
  return sanitize(value) as Record<string, unknown>;
}

export function validateAnalyticsWebhookOutput(value: unknown) {
  return validateWrappedWebhookOutput(value, (candidate) => {
    const validated = validateAnalyticsOutput(candidate);
    if (!validated) return null;
    const sanitized = sanitizeAnalyticsInsights(validated);
    if (!sanitized) return null;
    return validateAnalyticsOutput(sanitized);
  });
}
