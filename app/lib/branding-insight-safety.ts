import { validateBrandingOutput, type ModuleExecutionInput } from "@/app/lib/easy-mode-execution-contracts";

const AWARD = /\b(?:award[- ]winning|awards?|accolades?|honou?rs?)\b/i;
const OPERATING_HISTORY = /\b(?:\d+\+?\s+years?(?: of experience)?|since\s+(?:19|20)\d{2}|founded|established)\b/i;
const CLIENT_COUNT = /\b\d[\d,]*\+?\s+(?:clients?|customers?|projects?|businesses?)\b/i;
const CERTIFICATION = /\b(?:certified|certification|accredited|licensed|iso\s*\d*)\b/i;
const FOUNDER_HISTORY = /\b(?:founder|founded by|family[- ]owned|generations? of)\b/i;
const TESTIMONIAL = /\b(?:testimonials?|customer reviews?|client stories|client films?|case stud(?:y|ies)|customer proof)\b/i;
const GUARANTEE = /\b(?:guarantee|guaranteed|warranty|risk[- ]free|money[- ]back|assured results?|on time,? on budget|built to last)\b/i;
const SUPERLATIVE = /\b(?:#\s*1|number one|best[- ]in[- ]class|industry[- ]leading|market leader|leading provider|renowned|trusted by|proven track record|global presence)\b/i;
const INVENTED_ORIGIN = /\b(?:we|the business|the company|our (?:brand|business|company))\s+(?:started|began|launched|grew|evolved)\b/i;
const SOCIAL_METRIC = /\b(?:\d[\d,.]*\+?\s*(?:likes?|followers?|shares?|views?|comments?|impressions?|engagements?)|engagement rate|social reach)\b/i;
const CONTACT_ARTIFACT = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:https?:\/\/|www\.)\S+|\+?\d[\d\s().-]{6,}\d)/i;
const FINANCIAL_ARTIFACT = /\b(?:invoice(?:\s*(?:no|number|#))?|bill(?:ed)? to|client name|subtotal|total|payment details?|bank|upi|account number|price|fee)\b|(?:₹|\$|€|£)\s*\d/i;

function corpus(input: ModuleExecutionInput) {
  return [input.companyName, input.industry, input.targetAudience, input.brandStyle, input.brandDescription]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" ").toLowerCase();
}

function supported(sentence: string, context: string, pattern: RegExp) {
  const match = sentence.match(pattern)?.[0]?.toLowerCase();
  return Boolean(match && context.includes(match));
}

function groundedStory(input: ModuleExecutionInput) {
  const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const companyName = text(input.companyName, "The business");
  const brandStyle = text(input.brandStyle, "professional").toLowerCase();
  const industry = text(input.industry, "business services").toLowerCase();
  const targetAudience = text(input.targetAudience, "its customers").toLowerCase();
  return `${companyName} brings a ${brandStyle} brand direction to ${industry}, with a clear focus on ${targetAudience}.`;
}

function sanitizeSentence(sentence: string, context: string, input: ModuleExecutionInput) {
  if (/\b(?:describe operating history only|develop an origin story only|mention awards only|include founder history only|use (?:client|project) counts only|mention certifications? or licences? only|consider approved customer proof only|present guarantees? or warranties? only|use evidence-based positioning without|use social proof metrics only|use only approved business contact details|use financial document examples only)\b/i.test(sentence)) return groundedStory(input);
  if (INVENTED_ORIGIN.test(sentence) && !supported(sentence, context, INVENTED_ORIGIN)) return groundedStory(input);
  if (SOCIAL_METRIC.test(sentence) || CONTACT_ARTIFACT.test(sentence) || FINANCIAL_ARTIFACT.test(sentence)) return null;
  if (AWARD.test(sentence) && !supported(sentence, context, AWARD)) return null;
  if (FOUNDER_HISTORY.test(sentence) && !supported(sentence, context, FOUNDER_HISTORY)) return groundedStory(input);
  if (OPERATING_HISTORY.test(sentence) && !supported(sentence, context, OPERATING_HISTORY)) return groundedStory(input);
  if (CLIENT_COUNT.test(sentence) && !supported(sentence, context, CLIENT_COUNT)) return null;
  if (CERTIFICATION.test(sentence) && !supported(sentence, context, CERTIFICATION)) return null;
  if (TESTIMONIAL.test(sentence) && !supported(sentence, context, TESTIMONIAL)) return "Show the business's project approach and service process with owner-approved visuals.";
  if (GUARANTEE.test(sentence) && !supported(sentence, context, GUARANTEE)) return "Focus the message on the quality and clarity of the approved services.";
  if (SUPERLATIVE.test(sentence) && !supported(sentence, context, SUPERLATIVE)) return "Position the brand through its approved services and customer value.";
  return sentence;
}

function sanitizeText(value: string, context: string, input: ModuleExecutionInput, key: string) {
  const sentences = value.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const sanitized = [...new Set(sentences.map((sentence) => sanitizeSentence(sentence, context, input)).filter((item): item is string => Boolean(item)))];
  return sanitized.join("\n") || (key === "story" ? groundedStory(input) : "");
}

export function sanitizeBrandingOutput(value: unknown, input: ModuleExecutionInput) {
  const validated = validateBrandingOutput(value);
  if (!validated) return null;
  const context = corpus(input);
  return Object.fromEntries(Object.entries(validated).map(([key, text]) => [key, sanitizeText(String(text), context, input, key)]));
}

export function readStoredBrandingOutput(value: unknown, input: ModuleExecutionInput) {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return null; }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.hasOwn(parsed, "output")) parsed = (parsed as Record<string, unknown>).output;
  return sanitizeBrandingOutput(parsed, input);
}
