import type { UiuxBusinessContext } from "@/app/lib/uiux-business-context";
import type { NormalizedModuleOutput } from "@/app/lib/easy-mode-execution-contracts";

const RESEARCH = /\b(?:research (?:shows?|found)|users? (?:said|reported|preferred)|we (?:interviewed|surveyed|tested)|usability (?:tests?|testing) (?:showed|found|proved)|heatmaps?|session recordings?)\b/i;
const METRIC = /\b(?:conversion|engagement|bounce rate|task completion|time on task|success rate|click[- ]through|retention)\b[^.!?\n]{0,80}(?:\d|%|increase|improve|lift|reduce)/i;
const COMPLIANCE = /\b(?:wcag|ada|accessibility)[^.!?\n]{0,80}\b(?:compliant|certified|passes?|meets?|conforms?)\b/i;
const LIVE_CLAIM = /\b(?:the (?:current|live|published) (?:site|website)|website (?:currently|already))\b/i;

function verifiedCorpus(context: UiuxBusinessContext) {
  return [context.business.name, context.business.industry, context.business.location,
    context.business.description, ...context.business.services, context.website.url].filter(Boolean).join(" ").toLowerCase();
}

function sanitizeSentence(sentence: string, context: UiuxBusinessContext, corpus: string) {
  if (RESEARCH.test(sentence)) return "Treat user needs and personas as hypotheses until validated through owner-approved user research.";
  if (METRIC.test(sentence)) return "Treat conversion and usability improvements as testable objectives, not measured results.";
  if (COMPLIANCE.test(sentence)) return "Use accessibility standards as implementation guidance and verify compliance through a formal audit.";
  if (LIVE_CLAIM.test(sentence) && (!context.website.published || !corpus.includes(sentence.toLowerCase()))) {
    return context.website.published
      ? "Review the verified published website before treating any interface observation as a measured finding."
      : "No published website is available for verified interface findings.";
  }
  return sentence;
}

export function sanitizeUiuxOutput(value: unknown, context: UiuxBusinessContext): NormalizedModuleOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const corpus = verifiedCorpus(context);
  const clean = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (typeof item !== "string") return [key, item];
    const sentences = item.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
    return [key, [...new Set(sentences.map((sentence) => sanitizeSentence(sentence, context, corpus)))].join("\n")];
  }));
  return clean as NormalizedModuleOutput;
}

export function readStoredUiuxOutput(value: unknown, context: UiuxBusinessContext, validate: (value: unknown) => NormalizedModuleOutput | null) {
  let parsed = value;
  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return null; } }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.hasOwn(parsed, "output")) parsed = (parsed as Record<string, unknown>).output;
  const validated = validate(parsed);
  return validated ? sanitizeUiuxOutput(validated, context) : null;
}
