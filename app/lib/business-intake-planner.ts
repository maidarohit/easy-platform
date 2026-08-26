import type { BusinessDnaContent, BusinessDnaLanguage } from "@/app/lib/business-dna";
import {
  BUSINESS_INTAKE_MAX_QUESTIONS,
  mergeExplicitDnaWithInferences,
  type BusinessIntakeAnalysis,
  type BusinessIntakeAnalysisInput,
  type SuggestedBusinessIntakeQuestion,
} from "@/app/lib/business-intake-analysis";
import { BUSINESS_INTAKE_QUESTIONS, getApplicableQuestions, hasExistingWebsite, isQuestionComplete } from "@/app/lib/business-intake-questions";

const text = {
  english: {
    customer: "Who is the customer you most want to reach?", offer: "What are the main products or services you want to be known for?",
    difference: "Why should a customer choose you?", goal: "What would you like the business to achieve in the next 6 to 12 months?",
    problem: "What problem are you solving for customers?", history: "What part of your business story should customers know?",
    modernize: "What should stay traditional, and what would you like to modernize?", website: "What is not working well with your current website?",
  },
  hindi: {
    customer: "आप किन ग्राहकों तक सबसे ज़्यादा पहुँचना चाहते हैं?", offer: "आप किन मुख्य उत्पादों या सेवाओं के लिए पहचाने जाना चाहते हैं?",
    difference: "ग्राहक आपको क्यों चुनें?", goal: "अगले 6 से 12 महीनों में आप व्यवसाय को कहाँ ले जाना चाहते हैं?",
    problem: "आप ग्राहकों की कौन-सी समस्या हल करते हैं?", history: "आपके व्यवसाय की कहानी में ग्राहकों को क्या जानना चाहिए?",
    modernize: "क्या पारंपरिक रखना है और क्या आधुनिक बनाना है?", website: "आपकी मौजूदा वेबसाइट में क्या ठीक से काम नहीं कर रहा है?",
  },
  hinglish: {
    customer: "Aap sabse zyada kin customers tak pahunchna chahte hain?", offer: "Aap kin main products ya services ke liye known hona chahte hain?",
    difference: "Customer aapko kyun choose kare?", goal: "Agle 6 se 12 months mein business ko kahan le jaana chahte hain?",
    problem: "Aap customers ki kaunsi problem solve karte hain?", history: "Aapki business story mein customers ko kya pata hona chahiye?",
    modernize: "Kya traditional rakhna hai aur kya modernize karna hai?", website: "Aapki current website mein kya sahi kaam nahi kar raha?",
  },
} as const;

function question(id: string, path: SuggestedBusinessIntakeQuestion["dnaPath"], value: string, required = true): SuggestedBusinessIntakeQuestion {
  const source = BUSINESS_INTAKE_QUESTIONS.find((item) => item.path === path);
  return { id, dnaPath: path, question: value, reason: "This will make your business plan more specific.", required,
    answerType: source?.answerType ?? "textarea", ...(source?.options ? { options: source.options } : {}) };
}

function stage(dna: BusinessDnaContent) { return `${dna.identity?.businessStage ?? ""} ${dna.identity?.industry ?? ""}`.toLowerCase(); }
export function planAdaptiveQuestions(dna: BusinessDnaContent, language: BusinessDnaLanguage, maximum = BUSINESS_INTAKE_MAX_QUESTIONS) {
  const copy = text[language];
  const kind = stage(dna);
  const startup = /startup|starting|new|idea/.test(kind);
  const family = /family|second.generation|inherited/.test(kind) || /family|second.generation|inherited/.test(`${dna.founderHistory?.businessGeneration ?? ""}`.toLowerCase());
  const established = /existing|established|msme|manufactur/.test(kind);
  const candidates: SuggestedBusinessIntakeQuestion[] = [
    ...(startup ? [question("startup-problem", "founderHistory.whyStarted", copy.problem)] : []),
    ...(family ? [question("heritage", "founderHistory.founderStory", copy.history), question("modernize", "goals.primaryGoal", copy.modernize)] : []),
    ...(established ? [question("business-age", "founderHistory.businessAge", BUSINESS_INTAKE_QUESTIONS.find((q) => q.id === "business-age")!.question), question("current-customers", "customers.currentCustomers", copy.customer)] : []),
    question("desired-customers", "customers.desiredCustomers", copy.customer),
    question("strongest-offers", "offer.strongestOffers", copy.offer),
    question("differentiators", "offer.differentiators", copy.difference, false),
    ...(hasExistingWebsite(dna) ? [question("website-problem", "digitalPresence.websiteStatus", copy.website, false)] : []),
    question("future-goal", "goals.sixToTwelveMonthGoal", copy.goal),
  ];
  const fallback = getApplicableQuestions(dna).filter((item) => item.required && !isQuestionComplete(item, dna)).map((item) => question(item.id, item.path, language === "english" ? item.question : item.questionHindi ?? item.question));
  return [...candidates, ...fallback].filter((item, index, all) => all.findIndex((other) => other.dnaPath === item.dnaPath) === index)
    .filter((item) => {
      const original = BUSINESS_INTAKE_QUESTIONS.find((candidate) => candidate.path === item.dnaPath);
      return !original || !isQuestionComplete(original, dna);
    }).slice(0, Math.min(maximum, BUSINESS_INTAKE_MAX_QUESTIONS));
}

function extractVision(vision: string): BusinessDnaContent {
  const dna: BusinessDnaContent = {};
  const city = vision.match(/\b(?:in|based in|from)\s+([A-Z][A-Za-z.-]+(?:\s+[A-Z][A-Za-z.-]+)?)/)?.[1];
  const age = vision.match(/\b(?:for|since)\s+((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:years?|months?))/i)?.[1];
  const industry = vision.match(/\b(?:run|own|starting|building)\s+(?:an?\s+)?([a-z][a-z -]{2,40}?)(?:\s+(?:in|for|that|which)|[.,]|$)/i)?.[1];
  const website = /\b(?:no|don'?t have|without)\s+(?:a\s+)?website\b/i.test(vision) ? "no" : undefined;
  if (city) dna.location = { city };
  if (age) dna.founderHistory = { businessAge: age };
  if (industry) dna.identity = { industry: industry.trim() };
  if (website) dna.digitalPresence = { existingWebsite: website };
  return dna;
}

export function analyzeBusinessIntakeDeterministically(input: BusinessIntakeAnalysisInput): BusinessIntakeAnalysis {
  const extractedDna = extractVision(input.originalVisionText);
  const combined = mergeExplicitDnaWithInferences(input.savedDna, extractedDna);
  const questions = planAdaptiveQuestions(combined, input.preferredLanguage);
  const name = combined.identity?.businessName || "your business";
  return {
    extractedDna,
    confidence: Object.fromEntries(Object.entries(extractedDna).flatMap(([section, fields]) => Object.keys(fields ?? {}).map((field) => [`${section}.${field}`, "supported"]))),
    missingAreas: questions.map((item) => item.dnaPath),
    suggestedQuestions: questions,
    understandingSummary: `I understand the vision for ${name} and will use your story, customers, offer, location and goals as the source of truth.`,
    buildPlanSummary: [
      "A brand direction grounded in your business story and differentiators",
      "A website plan shaped around your target customers and strongest offers",
      "SEO foundations for your services and operating area",
      "Marketing and lead actions aligned with your growth goal",
    ],
  };
}
