import {
  validateBusinessDnaPatch,
  type BusinessDnaContent,
  type BusinessDnaLanguage,
} from "@/app/lib/business-dna";
import { isBusinessIntakePathApplicable, type BusinessIntakePath } from "@/app/lib/business-intake-questions";

export const BUSINESS_INTAKE_MAX_QUESTIONS = 8;

export const BUSINESS_DNA_ANALYSIS_PATHS = [
  "identity.businessName", "identity.industry", "identity.subIndustry", "identity.businessStage",
  "founderHistory.founderStory", "founderHistory.whyStarted", "founderHistory.businessAge", "founderHistory.businessGeneration",
  "location.city", "location.region", "location.country", "location.serviceAreas",
  "offer.products", "offer.services", "offer.strongestOffers", "offer.differentiators",
  "customers.currentCustomers", "customers.desiredCustomers", "customers.targetAudience",
  "digitalPresence.existingWebsite", "digitalPresence.websiteStatus", "digitalPresence.socialPresence", "digitalPresence.digitalProblems",
  "personality.brandPersonality", "personality.tone", "personality.trustSignals",
  "goals.vision", "goals.sixToTwelveMonthGoal", "goals.primaryGoal", "goals.primaryLeadObjective",
] as const;

export type BusinessDnaAnalysisPath = (typeof BUSINESS_DNA_ANALYSIS_PATHS)[number];
export type BusinessIntakeAnswerType = "text" | "textarea" | "choice" | "choice-or-text";

export type SuggestedBusinessIntakeQuestion = Readonly<{
  id: string;
  dnaPath: BusinessIntakePath;
  question: string;
  reason: string;
  required: boolean;
  answerType: BusinessIntakeAnswerType;
  options?: readonly Readonly<{ label: string; value: string }>[];
}>;

export type BusinessIntakeAnalysis = Readonly<{
  extractedDna: BusinessDnaContent;
  confidence?: Readonly<Record<string, "supported" | "uncertain">>;
  missingAreas: readonly string[];
  suggestedQuestions: readonly SuggestedBusinessIntakeQuestion[];
  understandingSummary: string;
  buildPlanSummary: readonly string[];
}>;

export type BusinessIntakeAnalysisInput = Readonly<{
  preferredLanguage: BusinessDnaLanguage;
  originalVisionText: string;
  savedDna: BusinessDnaContent;
}>;

const PATH_SET = new Set<string>(BUSINESS_DNA_ANALYSIS_PATHS);
export const BUSINESS_INTAKE_QUESTION_PATHS = [
  "identity.businessName", "identity.businessStage", "founderHistory.founderStory", "founderHistory.whyStarted",
  "founderHistory.businessAge", "founderHistory.businessGeneration", "location.city", "location.serviceAreas",
  "offer.strongestOffers", "offer.differentiators", "customers.currentCustomers", "customers.desiredCustomers",
  "digitalPresence.existingWebsite", "digitalPresence.websiteStatus", "digitalPresence.socialPresence",
  "digitalPresence.digitalProblems", "personality.brandPersonality", "goals.sixToTwelveMonthGoal",
  "goals.primaryGoal", "goals.primaryLeadObjective",
] as const satisfies readonly BusinessIntakePath[];
const QUESTION_PATH_SET = new Set<string>(BUSINESS_INTAKE_QUESTION_PATHS);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 500);
}

export function validateBusinessIntakeAnalysis(value: unknown): BusinessIntakeAnalysis | null {
  if (!object(value) || Object.keys(value).some((key) => ![
    "extractedDna", "confidence", "missingAreas", "suggestedQuestions", "understandingSummary", "buildPlanSummary",
  ].includes(key))) return null;
  const extractedDna = validateBusinessDnaPatch(value.extractedDna);
  if (!extractedDna || extractedDna.conversation) return null;
  if (!strings(value.missingAreas, 12) || !strings(value.buildPlanSummary, 8) ||
      typeof value.understandingSummary !== "string" || !value.understandingSummary.trim() || value.understandingSummary.length > 2_000 ||
      !Array.isArray(value.suggestedQuestions) || value.suggestedQuestions.length > BUSINESS_INTAKE_MAX_QUESTIONS) return null;
  let confidence: Record<string, "supported" | "uncertain"> | undefined;
  if (value.confidence !== undefined) {
    if (!object(value.confidence)) return null;
    confidence = {};
    for (const [path, state] of Object.entries(value.confidence)) {
      if (!PATH_SET.has(path) || (state !== "supported" && state !== "uncertain")) return null;
      confidence[path] = state;
    }
  }
  const questions: SuggestedBusinessIntakeQuestion[] = [];
  for (const candidate of value.suggestedQuestions) {
    if (!object(candidate) || Object.keys(candidate).some((key) => !["id", "dnaPath", "question", "reason", "required", "answerType", "options"].includes(key)) ||
        typeof candidate.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(candidate.id) ||
        typeof candidate.dnaPath !== "string" || !QUESTION_PATH_SET.has(candidate.dnaPath) ||
        typeof candidate.question !== "string" || !candidate.question.trim() || candidate.question.length > 500 ||
        typeof candidate.reason !== "string" || !candidate.reason.trim() || candidate.reason.length > 500 ||
        typeof candidate.required !== "boolean" || !["text", "textarea", "choice", "choice-or-text"].includes(String(candidate.answerType))) return null;
    let options: { label: string; value: string }[] | undefined;
    if (candidate.options !== undefined) {
      if (!Array.isArray(candidate.options) || candidate.options.length > 8) return null;
      options = [];
      for (const option of candidate.options) {
        if (!object(option) || Object.keys(option).some((key) => !["label", "value"].includes(key)) ||
            typeof option.label !== "string" || !option.label.trim() || option.label.length > 200 ||
            typeof option.value !== "string" || !option.value.trim() || option.value.length > 200) return null;
        options.push({ label: option.label, value: option.value });
      }
    }
    questions.push({
      id: candidate.id, dnaPath: candidate.dnaPath as BusinessIntakePath, question: candidate.question,
      reason: candidate.reason, required: candidate.required, answerType: candidate.answerType as BusinessIntakeAnswerType,
      ...(options ? { options } : {}),
    });
  }
  return { extractedDna, ...(confidence ? { confidence } : {}), missingAreas: value.missingAreas,
    suggestedQuestions: questions, understandingSummary: value.understandingSummary, buildPlanSummary: value.buildPlanSummary };
}

export function businessIntakeAnalysisIssuePaths(value: unknown): string[] {
  if (validateBusinessIntakeAnalysis(value)) return [];
  const issues = new Set<string>();
  if (!object(value)) return ["$"];
  const dna = validateBusinessDnaPatch(value.extractedDna);
  if (!dna || dna.conversation) issues.add("extractedDna");
  if (!strings(value.missingAreas, 12)) issues.add("missingAreas");
  if (!strings(value.buildPlanSummary, 8)) issues.add("buildPlanSummary");
  if (typeof value.understandingSummary !== "string" || !value.understandingSummary.trim() || value.understandingSummary.length > 2_000) issues.add("understandingSummary");
  if (!Array.isArray(value.suggestedQuestions)) issues.add("suggestedQuestions");
  else value.suggestedQuestions.forEach((candidate, index) => {
    if (!object(candidate)) issues.add(`suggestedQuestions.${index}`);
    else if (typeof candidate.dnaPath !== "string" || !QUESTION_PATH_SET.has(candidate.dnaPath)) issues.add(`suggestedQuestions.${index}.dnaPath`);
  });
  if (value.confidence !== undefined && !object(value.confidence)) issues.add("confidence");
  return [...issues].slice(0, 12);
}

function pathValue(dna: BusinessDnaContent, path: string): unknown {
  const [section, field] = path.split(".");
  return (dna[section as keyof BusinessDnaContent] as Record<string, unknown> | undefined)?.[field];
}

function hasValue(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== undefined;
}

/** Stored customer answers always win. Inferences fill only genuinely empty fields. */
export function mergeExplicitDnaWithInferences(explicit: BusinessDnaContent, inferred: BusinessDnaContent): BusinessDnaContent {
  const merged = structuredClone(explicit);
  for (const path of BUSINESS_DNA_ANALYSIS_PATHS) {
    if (hasValue(pathValue(explicit, path))) continue;
    const inferredValue = pathValue(inferred, path);
    if (!hasValue(inferredValue)) continue;
    const [section, field] = path.split(".");
    const target = (merged as Record<string, Record<string, unknown>>)[section] ?? {};
    target[field] = inferredValue;
    (merged as Record<string, Record<string, unknown>>)[section] = target;
  }
  return merged;
}

export function unansweredSuggestedQuestions(analysis: BusinessIntakeAnalysis, dna: BusinessDnaContent) {
  return analysis.suggestedQuestions.filter((question) =>
    isBusinessIntakePathApplicable(question.dnaPath, dna) && !hasValue(pathValue(dna, question.dnaPath)));
}
