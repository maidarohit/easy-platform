import type { BusinessDnaContent } from "@/app/lib/business-dna";

export type BusinessIntakePath =
  | "identity.businessName"
  | "identity.businessStage"
  | "founderHistory.founderStory"
  | "founderHistory.whyStarted"
  | "founderHistory.businessAge"
  | "founderHistory.businessGeneration"
  | "location.city"
  | "location.serviceAreas"
  | "offer.strongestOffers"
  | "offer.differentiators"
  | "customers.currentCustomers"
  | "customers.desiredCustomers"
  | "digitalPresence.existingWebsite"
  | "digitalPresence.websiteStatus"
  | "digitalPresence.socialPresence"
  | "digitalPresence.digitalProblems"
  | "personality.brandPersonality"
  | "goals.sixToTwelveMonthGoal"
  | "goals.primaryGoal"
  | "goals.primaryLeadObjective";

export type BusinessIntakeQuestion = Readonly<{
  id: string;
  path: BusinessIntakePath;
  question: string;
  questionHindi?: string;
  help?: string;
  required: boolean;
  answerType: "text" | "textarea" | "choice" | "choice-or-text";
  options?: readonly Readonly<{ label: string; value: string }>[];
  applicability?: (dna: BusinessDnaContent) => boolean;
}>;

const HINDI_QUESTIONS: Readonly<Record<string, string>> = {
  "business-name": "आपके व्यवसाय का नाम क्या है?",
  "business-stage": "आज आपके व्यवसाय की स्थिति क्या है?",
  "business-age": "आप यह व्यवसाय कितने समय से कर रहे हैं?",
  "business-generation": "यह व्यवसाय कैसे शुरू हुआ?",
  "why-started": "आपने यह व्यवसाय क्यों शुरू किया या संभाला?",
  "founder-story": "क्या आपकी कहानी में कुछ ऐसा है जो ग्राहकों को जानना चाहिए?",
  location: "आपका व्यवसाय कहाँ स्थित है?",
  "service-areas": "आप स्थानीय ग्राहकों, पूरे भारत या किसी और क्षेत्र में सेवा देते हैं?",
  "current-customers": "आज आपसे आम तौर पर कौन खरीदता है?",
  "desired-customers": "आप किन लोगों को अपना ग्राहक बनाना चाहते हैं?",
  "strongest-offers": "आप मुख्य रूप से क्या बेचते हैं या कौन-सी सेवाएँ देते हैं?",
  differentiators: "ग्राहक दूसरों के बजाय आपको क्यों चुनते हैं?",
  "existing-website": "क्या आपकी पहले से कोई वेबसाइट है?",
  "website-problem": "आपकी मौजूदा वेबसाइट में क्या ठीक से काम नहीं कर रहा?",
  "social-presence": "क्या आप व्यवसाय के लिए Instagram, Facebook, LinkedIn या कुछ और इस्तेमाल करते हैं?",
  "digital-problems": "आपकी ऑनलाइन मौजूदगी में क्या ठीक से काम नहीं कर रहा?",
  "primary-goal": "आप Buzypeezy से सबसे पहले क्या हासिल करना चाहते हैं?",
  "future-goal": "अगले 6 से 12 महीनों में आप व्यवसाय को कहाँ देखना चाहते हैं?",
  "lead-objective": "अभी आपके लिए सबसे उपयोगी क्या होगा?",
  "brand-personality": "लोग आपके व्यवसाय को ऑनलाइन देखकर कैसा महसूस करें?",
};

export function businessIntakeQuestionText(question: BusinessIntakeQuestion, language: "english" | "hindi" | "hinglish") {
  return language === "hindi" ? (question.questionHindi ?? HINDI_QUESTIONS[question.id] ?? question.question) : question.question;
}

const stage = (dna: BusinessDnaContent) => dna.identity?.businessStage?.toLowerCase() ?? "";
export const isStartupBusiness = (dna: BusinessDnaContent) =>
  ["starting", "startup", "new", "idea"].some((word) => stage(dna).includes(word));
export const isEstablishedBusiness = (dna: BusinessDnaContent) =>
  ["established", "existing", "family", "msme"].some((word) => stage(dna).includes(word));
export const hasExistingWebsite = (dna: BusinessDnaContent) => {
  const answer = dna.digitalPresence?.existingWebsite?.trim().toLowerCase();
  return Boolean(answer && answer !== "no" && answer !== "none" && answer !== "not yet");
};
const hasSocialPresence = (dna: BusinessDnaContent) => Boolean(dna.digitalPresence?.socialPresence?.length);

export const BUSINESS_INTAKE_QUESTIONS: readonly BusinessIntakeQuestion[] = [
  {
    id: "business-name", path: "identity.businessName", required: true, answerType: "text",
    question: "What should we call your business?",
  },
  {
    id: "business-stage", path: "identity.businessStage", required: true, answerType: "choice",
    question: "Which best describes your business today?",
    options: [
      { label: "I’m starting something new", value: "startup/new" },
      { label: "I run an existing business", value: "established/existing" },
      { label: "It’s a family business", value: "family business" },
      { label: "I’m growing an MSME", value: "established MSME" },
    ],
  },
  {
    id: "business-age", path: "founderHistory.businessAge", required: true, answerType: "text",
    question: "How long have you been doing this business?",
    applicability: isEstablishedBusiness,
  },
  {
    id: "business-generation", path: "founderHistory.businessGeneration", required: true, answerType: "choice-or-text",
    question: "How did this business begin?",
    options: [
      { label: "I started it myself", value: "first-generation" },
      { label: "It’s a family business", value: "family" },
      { label: "I’m the second generation", value: "second-generation" },
      { label: "I inherited it", value: "inherited" },
      { label: "I acquired it", value: "acquired" },
    ],
    applicability: isEstablishedBusiness,
  },
  {
    id: "why-started", path: "founderHistory.whyStarted", required: false, answerType: "textarea",
    question: "What made you start or take on this business?",
    help: "A short answer is fine.",
  },
  {
    id: "founder-story", path: "founderHistory.founderStory", required: false, answerType: "textarea",
    question: "Is there anything about your story that customers should know?",
  },
  {
    id: "location", path: "location.city", required: true, answerType: "text",
    question: "Where is your business based?",
  },
  {
    id: "service-areas", path: "location.serviceAreas", required: false, answerType: "text",
    question: "Do you mainly serve customers near you, across India, or somewhere else?",
    help: "You can list more than one area, separated by commas.",
  },
  {
    id: "current-customers", path: "customers.currentCustomers", required: true, answerType: "textarea",
    question: "Who usually buys from you today?",
    applicability: isEstablishedBusiness,
  },
  {
    id: "desired-customers", path: "customers.desiredCustomers", required: true, answerType: "textarea",
    question: "Who would you like to get more customers from?",
  },
  {
    id: "strongest-offers", path: "offer.strongestOffers", required: true, answerType: "textarea",
    question: "What are the main things you sell or provide?",
    help: "List products or services in your own words.",
  },
  {
    id: "differentiators", path: "offer.differentiators", required: false, answerType: "textarea",
    question: "What do customers choose you for instead of someone else?",
  },
  {
    id: "existing-website", path: "digitalPresence.existingWebsite", required: true, answerType: "choice-or-text",
    question: "Do you already have a website?",
    options: [
      { label: "No, not yet", value: "no" },
      { label: "Yes", value: "yes" },
    ],
    help: "If yes, you can paste the website address instead.",
  },
  {
    id: "website-problem", path: "digitalPresence.websiteStatus", required: false, answerType: "textarea",
    question: "What is not working well with your current website?",
    applicability: hasExistingWebsite,
  },
  {
    id: "social-presence", path: "digitalPresence.socialPresence", required: false, answerType: "text",
    question: "Are you using Instagram, Facebook, LinkedIn or anything else for the business?",
    help: "List the places you use, separated by commas.",
  },
  {
    id: "digital-problems", path: "digitalPresence.digitalProblems", required: false, answerType: "textarea",
    question: "What is not working well with your online presence?",
    applicability: (dna) => hasExistingWebsite(dna) || hasSocialPresence(dna),
  },
  {
    id: "primary-goal", path: "goals.primaryGoal", required: true, answerType: "choice-or-text",
    question: "What would you most like Buzypeezy to help you achieve?",
    options: [
      { label: "Get more customers", value: "Get more customers" },
      { label: "Improve my online presence", value: "Improve my online presence" },
      { label: "Increase sales", value: "Increase sales" },
      { label: "Launch something new", value: "Launch something new" },
    ],
  },
  {
    id: "future-goal", path: "goals.sixToTwelveMonthGoal", required: true, answerType: "textarea",
    question: "Where would you like this business to be in the next 6 to 12 months?",
  },
  {
    id: "lead-objective", path: "goals.primaryLeadObjective", required: true, answerType: "choice-or-text",
    question: "What would be most valuable right now?",
    options: [
      { label: "More enquiries", value: "More enquiries" },
      { label: "More calls", value: "More calls" },
      { label: "More bookings", value: "More bookings" },
      { label: "More online sales", value: "More online sales" },
    ],
  },
  {
    id: "brand-personality", path: "personality.brandPersonality", required: false, answerType: "choice-or-text",
    question: "How should people feel when they see your business online?",
    options: [
      { label: "Professional and trustworthy", value: "Professional, trustworthy" },
      { label: "Warm and approachable", value: "Warm, approachable" },
      { label: "Modern and confident", value: "Modern, confident" },
      { label: "Premium and refined", value: "Premium, refined" },
    ],
  },
];

function pathValue(dna: BusinessDnaContent, path: BusinessIntakePath): unknown {
  const [section, field] = path.split(".") as [keyof BusinessDnaContent, string];
  return (dna[section] as Record<string, unknown> | undefined)?.[field];
}

export function isQuestionComplete(question: BusinessIntakeQuestion, dna: BusinessDnaContent) {
  const value = pathValue(dna, question.path);
  if (Array.isArray(value)) return question.required ? value.length > 0 : value !== undefined;
  if (typeof value === "string") return question.required ? value.trim().length > 0 : true;
  return false;
}

export function getApplicableQuestions(dna: BusinessDnaContent) {
  const applicable = BUSINESS_INTAKE_QUESTIONS.filter((question) => question.applicability?.(dna) ?? true);
  if (!isStartupBusiness(dna)) return applicable;
  const startupPriority = [
    "business-name", "business-stage", "why-started", "desired-customers", "strongest-offers",
    "primary-goal", "future-goal", "location",
  ];
  return [...applicable].sort((a, b) => {
    const aIndex = startupPriority.indexOf(a.id);
    const bIndex = startupPriority.indexOf(b.id);
    return (aIndex < 0 ? 100 : aIndex) - (bIndex < 0 ? 100 : bIndex);
  });
}

export function getNextBusinessIntakeQuestion(dna: BusinessDnaContent) {
  return getApplicableQuestions(dna).find((question) => !isQuestionComplete(question, dna)) ?? null;
}

const listPaths = new Set<BusinessIntakePath>([
  "location.serviceAreas", "offer.strongestOffers", "offer.differentiators",
  "digitalPresence.socialPresence", "digitalPresence.digitalProblems", "personality.brandPersonality",
]);

export function answerToBusinessDnaPatch(question: BusinessIntakeQuestion, answer: string): BusinessDnaContent {
  const [section, field] = question.path.split(".") as [keyof BusinessDnaContent, string];
  const value = listPaths.has(question.path)
    ? answer.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)
    : answer.trim();
  return { [section]: { [field]: value } } as BusinessDnaContent;
}
