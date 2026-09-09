import type { UiuxBusinessContext } from "@/app/lib/uiux-business-context";
import type { NormalizedModuleOutput } from "@/app/lib/easy-mode-execution-contracts";

const RESEARCH = /\b(?:research (?:shows?|found)|users? (?:said|reported|preferred)|we (?:interviewed|surveyed|tested)|usability (?:tests?|testing) (?:showed|found|proved)|heatmaps?|session recordings?)\b/i;
const METRIC = /\b(?:conversion|engagement|bounce rate|task completion|time on task|success rate|click[- ]through|retention)\b[^.!?\n]{0,80}(?:\d|%|increase|improve|lift|reduce)/i;
const COMPLIANCE = /\b(?:wcag|ada|accessibility)[^.!?\n]{0,80}\b(?:compliant|certified|passes?|meets?|conforms?)\b/i;
const LIVE_CLAIM = /\b(?:the (?:current|live|published) (?:site|website)|website (?:currently|already))\b/i;
const UNVERIFIED_CAPABILITY = /\b(?:dashboard|configurator|e-?sign(?:ature)?|scheduling|calendar|automated? emails?|automation|milestone payments?|3d viewers?|awards?|testimonials?|case stud(?:y|ies)|office locations?|financing|referrals?|client portals?|integrations?)\b/gi;
const PROPOSED = /^\s*(?:proposed|recommended|consider|optional|hypothetical|suggested)\b/i;
const BRAND_SYSTEM = /\b(?:colou?r(?:s| scheme)?|palette|fonts?|typeface|typography|brand voice|tone of voice|visual direction|brand direction)\b/i;
const BRANDING_CONTENT = /^\s*(?:branding|brand(?:ing)? system)\b/i;
const UI_COLOUR_PROPOSAL = /\b(?:ui|interface|interaction|state|surface|background|accent|semantic|feedback|success|warning|error|info|neutral|border|hover|focus|disabled)\b[^.!?\n]{0,100}\b(?:colou?r|palette|#[\da-f]{3,8}\b)/i;
const UI_COLOUR_LABEL = /^Proposed UI extension colors\s*[—–-]\s*/i;

function cleanFormatting(text: string) {
  return text
    .replace(/^\s*(?:(?:\d+[.)]|[-*•])\s*)+/, "")
    .replace(/^(?:Proposed recommendation\s*[—–-]\s*)+/i, "Proposed recommendation — ")
    .replace(/^(Proposed recommendation\s*—)\s*(?:(?:\d+[.)]|[-*•])\s*)+/i, "$1 ")
    .trim();
}

function verifiedCorpus(context: UiuxBusinessContext) {
  return [context.business.name, context.business.industry, context.business.location,
    context.business.description, ...context.business.services, context.website.url].filter(Boolean).join(" ").toLowerCase();
}

function sanitizeSentence(sentence: string, context: UiuxBusinessContext, corpus: string) {
  sentence = cleanFormatting(sentence);
  if (RESEARCH.test(sentence)) return "Treat user needs and personas as hypotheses until validated through owner-approved user research.";
  if (METRIC.test(sentence)) return "Treat conversion and usability improvements as testable objectives, not measured results.";
  if (COMPLIANCE.test(sentence)) return "Use accessibility standards as implementation guidance and verify compliance through a formal audit.";
  if (LIVE_CLAIM.test(sentence) && (!context.website.published || !corpus.includes(sentence.toLowerCase()))) {
    return context.website.published
      ? "Review the verified published website before treating any interface observation as a measured finding."
      : "No published website is available for verified interface findings.";
  }
  const capabilities = [...sentence.matchAll(UNVERIFIED_CAPABILITY)].map((match) => match[0].toLowerCase());
  if (capabilities.some((capability) => !corpus.includes(capability)) && !PROPOSED.test(sentence)) {
    return `Proposed recommendation — ${sentence}`;
  }
  return sentence;
}

export function sanitizeUiuxOutput(value: unknown, context: UiuxBusinessContext): NormalizedModuleOutput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const corpus = verifiedCorpus(context);
  const clean = Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (typeof item !== "string") return [key, item];
    let sentences = item.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+/).map(cleanFormatting).filter(Boolean);
    const proposedUiColours = key === "designSystem" && context.branding
      ? sentences.filter((sentence) => BRAND_SYSTEM.test(sentence) && UI_COLOUR_PROPOSAL.test(sentence))
      : [];
    if (context.branding) sentences = sentences.filter((sentence) => !BRAND_SYSTEM.test(sentence) && !(key === "designSystem" && BRANDING_CONTENT.test(sentence)));
    let text = [...new Set(sentences.map((sentence) => sanitizeSentence(sentence, context, corpus)))].join("\n");
    if (key === "colourScheme" && context.branding) text = context.branding.palette;
    if (key === "userPersonas" && !/^Hypothetical \/ Proposed personas:/i.test(text)) text = `Hypothetical / Proposed personas:\n${text}`;
    if (key === "designSystem" && context.branding) {
      const grounding = `Verified Branding system — palette: ${context.branding.palette}; typography: ${context.branding.typography}; brand voice: ${context.branding.voice}; visual direction: ${context.branding.direction}.`;
      const extension = [...new Set(proposedUiColours.map((sentence) => sentence.replace(UI_COLOUR_LABEL, "")))]
        .map((sentence) => `Proposed UI extension colors — ${sentence}`);
      text = [grounding, ...extension, text].filter(Boolean).join("\n");
    }
    return [key, text];
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
