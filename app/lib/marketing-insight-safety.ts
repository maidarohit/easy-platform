import type { MarketingBusinessContext } from "@/app/lib/marketing-business-context";

const UNSAVED_CLAIM = /\b(discount|free consultation|testimonial|years? of experience|guarantee|guaranteed|price|pricing)\b/i;
const UNSUPPORTED_METRIC = /\b(visitor|engagement|click-through|\bctr\b|campaign roi|marketing roi|customer acquisition cost|\bcac\b|conversion rate)\b/i;
const QUANTIFIED = /(?:\d|%|₹|\binr\b|\brs\.?\b)/i;
const URL = /https?:\/\/[^\s)\]}]+/gi;
const UNSUPPORTED_OUTPUT_KEY = /^(marketingDashboard|marketingScore)$/i;

function cleanText(value: string, context: MarketingBusinessContext) {
  const allowedUrl = context.website.url;
  const urlSafe = value.replace(URL, (url) => allowedUrl && url.replace(/[.,;:]$/, "") === allowedUrl ? allowedUrl : allowedUrl || "the website after it is published");
  const channelSafe = urlSafe.split(/(?<=[.!?])\s+/).map((sentence) => {
    if (context.channels.meta !== "connected" && /\b(meta|facebook|instagram)\b/i.test(sentence) && /\b(connected|posted|published|publish automatically)\b/i.test(sentence)) return "Meta (Facebook / Instagram) is not connected.";
    if (context.channels.linkedin !== "connected" && /\blinkedin\b/i.test(sentence) && /\b(connected|posted|published|publish automatically)\b/i.test(sentence)) return "LinkedIn is not connected.";
    return sentence;
  }).join(" ");
  const sentences = channelSafe.split(/(?<=[.!?])\s+/).filter((sentence) => {
    if (UNSUPPORTED_METRIC.test(sentence) && QUANTIFIED.test(sentence)) return false;
    if (UNSAVED_CLAIM.test(sentence)) return false;
    return true;
  });
  return sentences.join(" ").trim() || "Use only the verified business context and connected channels shown above.";
}

export function sanitizeMarketingInsights(value: unknown, context: MarketingBusinessContext): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const clean = (item: unknown): unknown => typeof item === "string" ? cleanText(item, context)
    : Array.isArray(item) ? item.map(clean)
      : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).filter(([key]) => !UNSUPPORTED_OUTPUT_KEY.test(key)).map(([key, nested]) => [key, clean(nested)])) : item;
  return clean(value) as Record<string, unknown>;
}
