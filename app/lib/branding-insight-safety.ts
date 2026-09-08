import { validateBrandingOutput, type ModuleExecutionInput } from "@/app/lib/easy-mode-execution-contracts";

const AWARD = /\b(?:award[- ]winning|awards?|accolades?|honou?rs?)\b/i;
const OPERATING_HISTORY = /\b(?:\d+\+?\s+years?(?: of experience)?|since\s+(?:19|20)\d{2}|founded|established)\b/i;
const CLIENT_COUNT = /\b\d[\d,]*\+?\s+(?:clients?|customers?|projects?|businesses?)\b/i;
const CERTIFICATION = /\b(?:certified|certification|accredited|licensed|iso\s*\d*)\b/i;
const FOUNDER_HISTORY = /\b(?:founder|founded by|family[- ]owned|generations? of)\b/i;
const TESTIMONIAL = /\b(?:testimonials?|customer reviews?|client stories|case stud(?:y|ies))\b/i;
const GUARANTEE = /\b(?:guarantee|guaranteed|warranty|risk[- ]free|money[- ]back|assured results?)\b/i;
const SUPERLATIVE = /\b(?:#\s*1|number one|best[- ]in[- ]class|industry[- ]leading|market leader|leading provider|renowned|trusted by|proven track record|global presence)\b/i;

function corpus(input: ModuleExecutionInput) {
  return [input.companyName, input.industry, input.targetAudience, input.brandStyle, input.brandDescription]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" ").toLowerCase();
}

function supported(sentence: string, context: string, pattern: RegExp) {
  const match = sentence.match(pattern)?.[0]?.toLowerCase();
  return Boolean(match && context.includes(match));
}

function sanitizeSentence(sentence: string, context: string) {
  if (AWARD.test(sentence) && !supported(sentence, context, AWARD)) return "Mention awards only when the business owner provides verified award details.";
  if (FOUNDER_HISTORY.test(sentence) && !supported(sentence, context, FOUNDER_HISTORY)) return "Include founder history only when it is present in the approved business description.";
  if (OPERATING_HISTORY.test(sentence) && !supported(sentence, context, OPERATING_HISTORY)) return "Describe operating history only when the business owner provides verified dates or experience.";
  if (CLIENT_COUNT.test(sentence) && !supported(sentence, context, CLIENT_COUNT)) return "Use client or project counts only when the business owner provides verified figures.";
  if (CERTIFICATION.test(sentence) && !supported(sentence, context, CERTIFICATION)) return "Mention certifications or licences only when the business owner provides verified credentials.";
  if (TESTIMONIAL.test(sentence) && !supported(sentence, context, TESTIMONIAL)) return "Consider approved customer proof only when verified testimonials or case studies are available.";
  if (GUARANTEE.test(sentence) && !supported(sentence, context, GUARANTEE)) return "Present guarantees or warranties only when the business owner approves exact terms.";
  if (SUPERLATIVE.test(sentence) && !supported(sentence, context, SUPERLATIVE)) return "Use evidence-based positioning without unverified leadership or reputation claims.";
  return sentence;
}

function sanitizeText(value: string, context: string) {
  const sentences = value.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(sentences.map((sentence) => sanitizeSentence(sentence, context)))].join("\n");
}

export function sanitizeBrandingOutput(value: unknown, input: ModuleExecutionInput) {
  const validated = validateBrandingOutput(value);
  if (!validated) return null;
  const context = corpus(input);
  return Object.fromEntries(Object.entries(validated).map(([key, text]) => [key, sanitizeText(String(text), context)]));
}

export function readStoredBrandingOutput(value: unknown, input: ModuleExecutionInput) {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return null; }
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.hasOwn(parsed, "output")) parsed = (parsed as Record<string, unknown>).output;
  return sanitizeBrandingOutput(parsed, input);
}
