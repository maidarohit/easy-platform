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

export type BusinessIntakeIntent =
  | "business_name" | "industry" | "business_stage" | "business_age" | "business_origin"
  | "current_customer" | "target_customer" | "products_services" | "strongest_offer"
  | "location" | "service_area" | "differentiator" | "website_status" | "website_problem"
  | "website_priority" | "social_presence" | "portfolio_proof" | "main_goal"
  | "six_to_twelve_month_goal" | "lead_goal" | "growth_objective" | "online_challenges" | "brand_personality";

export const BUSINESS_INTAKE_COMPLETION_MATRIX: Readonly<Record<BusinessIntakeIntent, readonly string[]>> = {
  business_name: ["identity.businessName"], industry: ["identity.industry"], business_stage: ["identity.businessStage"],
  business_age: ["founderHistory.businessAge"], business_origin: ["founderHistory.businessGeneration", "founderHistory.whyStarted", "founderHistory.founderStory"],
  current_customer: ["customers.currentCustomers"], target_customer: ["customers.desiredCustomers", "customers.targetAudience"],
  products_services: ["offer.strongestOffers", "offer.products", "offer.services"], strongest_offer: ["offer.strongestOffers"],
  location: ["location.city", "location.region", "location.country"], service_area: ["location.serviceAreas"], differentiator: ["offer.differentiators"],
  website_status: ["digitalPresence.existingWebsite"], website_problem: ["digitalPresence.websiteStatus"], website_priority: ["digitalPresence.websiteStatus"],
  social_presence: ["digitalPresence.socialPresence"], portfolio_proof: ["personality.trustSignals"], online_challenges: ["digitalPresence.digitalProblems"],
  main_goal: ["goals.primaryGoal", "goals.vision", "goals.sixToTwelveMonthGoal", "goals.primaryLeadObjective"],
  six_to_twelve_month_goal: ["goals.sixToTwelveMonthGoal"], lead_goal: ["goals.primaryLeadObjective"],
  growth_objective: ["goals.primaryGoal", "goals.sixToTwelveMonthGoal"],
  brand_personality: ["personality.brandPersonality"],
};

const STATIC_QUESTION_INTENTS: Readonly<Record<string, BusinessIntakeIntent>> = {
  "business-name": "business_name", "business-stage": "business_stage", "business-age": "business_age", "business-generation": "business_origin",
  "why-started": "business_origin", "founder-story": "business_origin", location: "location", "service-areas": "service_area",
  "current-customers": "current_customer", "desired-customers": "target_customer", "strongest-offers": "products_services", differentiators: "differentiator",
  "existing-website": "website_status", "website-problem": "website_problem", "social-presence": "social_presence", "digital-problems": "online_challenges",
  "primary-goal": "main_goal", "future-goal": "six_to_twelve_month_goal", "lead-objective": "lead_goal", "brand-personality": "brand_personality",
};

const PATH_INTENTS: Readonly<Record<string, BusinessIntakeIntent>> = {
  "identity.businessName": "business_name", "identity.industry": "industry", "identity.businessStage": "business_stage",
  "founderHistory.businessAge": "business_age", "founderHistory.businessGeneration": "business_origin", "founderHistory.whyStarted": "business_origin", "founderHistory.founderStory": "business_origin",
  "customers.currentCustomers": "current_customer", "customers.desiredCustomers": "target_customer", "customers.targetAudience": "target_customer",
  "offer.products": "products_services", "offer.services": "products_services", "offer.strongestOffers": "products_services", "offer.differentiators": "differentiator",
  "location.city": "location", "location.serviceAreas": "service_area", "digitalPresence.existingWebsite": "website_status",
  "digitalPresence.websiteStatus": "website_problem", "digitalPresence.socialPresence": "social_presence", "digitalPresence.digitalProblems": "online_challenges",
  "personality.trustSignals": "portfolio_proof", "personality.brandPersonality": "brand_personality", "goals.primaryGoal": "main_goal",
  "goals.sixToTwelveMonthGoal": "six_to_twelve_month_goal", "goals.primaryLeadObjective": "lead_goal",
};

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

export type WebsitePresence = "exists" | "none" | "unknown";

const NO_WEBSITE_VALUES = new Set(["no", "none", "not yet", "no website", "without website", "have portfolio"]);

function normalizedWebsiteValue(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9.'\s]/g, " ").replace(/\s+/g, " ") ?? "";
}

function meansNoWebsite(value: string) {
  return NO_WEBSITE_VALUES.has(value) ||
    /^(?:currently )?(?:do not|don't|does not|doesn't) (?:currently )?have (?:a )?(?:proper )?website\b/.test(value) ||
    /^(?:no|without) (?:a )?(?:proper )?website\b/.test(value);
}

export function websitePresence(dna: BusinessDnaContent): WebsitePresence {
  const existingWebsite = normalizedWebsiteValue(dna.digitalPresence?.existingWebsite);
  if (existingWebsite) return meansNoWebsite(existingWebsite) ? "none" : "exists";
  const websiteStatus = normalizedWebsiteValue(dna.digitalPresence?.websiteStatus);
  if (!websiteStatus) return "unknown";
  return meansNoWebsite(websiteStatus) ? "none" : "exists";
}

export const hasExistingWebsite = (dna: BusinessDnaContent) => websitePresence(dna) === "exists";
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

function valueAtAnyPath(dna: BusinessDnaContent, path: string): unknown {
  const [section, field] = path.split(".");
  return (dna[section as keyof BusinessDnaContent] as Record<string, unknown> | undefined)?.[field];
}

function meaningful(value: unknown) {
  return Array.isArray(value) ? value.some((item) => typeof item === "string" && item.trim())
    : typeof value === "string" ? Boolean(value.trim()) : false;
}

export function businessIntakeQuestionIntent(question: { id?: string; path?: string; dnaPath?: string; question: string }): BusinessIntakeIntent | null {
  const wording = question.question.toLowerCase();
  if (/\b(?:portfolio|case stud(?:y|ies)|testimonials?|proof)\b/.test(wording)) return "portfolio_proof";
  if (/\b(?:social profiles?|social channels?|instagram|facebook|linkedin)\b/.test(wording)) return "social_presence";
  if (/\b(?:website|site)\b/.test(wording) && /\b(?:build|create|future|want|need|priority|priorities|should include)\b/.test(wording)) return "website_priority";
  if (/\b(?:website|site)\b/.test(wording) && /\b(?:wrong|problem|performance|traffic|conversion|working well|not working)\b/.test(wording)) return "website_problem";
  if (/\b(?:website|site)\b/.test(wording) && /\b(?:have|existing|currently|already)\b/.test(wording)) return "website_status";
  if (/\b(?:6\s*(?:-|–|to)\s*12|next\s+(?:six|6|twelve|12)\s+months?|next\s+year)\b/.test(wording)) return "six_to_twelve_month_goal";
  if (/\b(?:leads?|enquir(?:y|ies)|calls?|bookings?|appointments?)\b/.test(wording) && /\b(?:goal|valuable|want|need|generate|more)\b/.test(wording)) return "lead_goal";
  if (/\b(?:main|primary|top)\s+goal\b/.test(wording)) return "main_goal";
  if (/\b(?:growth objective|grow (?:the |your )?business|business growth)\b/.test(wording)) return "growth_objective";
  if (/\b(?:customer|client|audience)\b/.test(wording) && /\b(?:want|reach|target|ideal|more|most)\b/.test(wording)) return "target_customer";
  if (/\b(?:customer|client)\b/.test(wording) && /\b(?:current|today|usually|already|buys?)\b/.test(wording)) return "current_customer";
  if (/\b(?:products?|services?|offerings?|sell|provide|known for)\b/.test(wording)) return "products_services";
  if (/\b(?:different|choose you|instead|unique|usp)\b/.test(wording)) return "differentiator";
  if (/\b(?:how long|business age|operating|in business)\b/.test(wording)) return "business_age";
  if (/\b(?:stage|starting|existing business|family business|msme)\b/.test(wording)) return "business_stage";
  if (question.id && STATIC_QUESTION_INTENTS[question.id]) return STATIC_QUESTION_INTENTS[question.id];
  return PATH_INTENTS[question.path ?? question.dnaPath ?? ""] ?? null;
}

export function isBusinessIntakeIntentComplete(intent: BusinessIntakeIntent, dna: BusinessDnaContent) {
  if (intent === "portfolio_proof" && dna.digitalPresence?.existingWebsite?.trim().toLowerCase() === "have_portfolio") return true;
  return BUSINESS_INTAKE_COMPLETION_MATRIX[intent].some((path) => meaningful(valueAtAnyPath(dna, path)));
}

export function isBusinessIntakeIntentApplicable(intent: BusinessIntakeIntent, dna: BusinessDnaContent) {
  return intent !== "website_problem" || hasExistingWebsite(dna);
}

export function isBusinessIntakeQuestionSemanticallyEligible(question: { id?: string; path?: string; dnaPath?: string; question: string }, dna: BusinessDnaContent) {
  const intent = businessIntakeQuestionIntent(question);
  return !intent || (isBusinessIntakeIntentApplicable(intent, dna) && !isBusinessIntakeIntentComplete(intent, dna));
}

export function isQuestionComplete(question: BusinessIntakeQuestion, dna: BusinessDnaContent) {
  const value = pathValue(dna, question.path);
  if (Array.isArray(value)) return question.required ? value.length > 0 : value !== undefined;
  if (typeof value === "string") return question.required ? value.trim().length > 0 : true;
  return false;
}

export function countSavedBusinessIntakeAnswers(dna: BusinessDnaContent) {
  return BUSINESS_INTAKE_QUESTIONS.filter((question) => isQuestionComplete(question, dna)).length;
}

export function isBusinessIntakePathApplicable(path: BusinessIntakePath, dna: BusinessDnaContent) {
  const question = BUSINESS_INTAKE_QUESTIONS.find((candidate) => candidate.path === path);
  return question?.applicability?.(dna) ?? true;
}

export function eligibleBusinessIntakeQuestions(questions: readonly BusinessIntakeQuestion[], dna: BusinessDnaContent) {
  return questions.filter((question) =>
    isBusinessIntakePathApplicable(question.path, dna) && !isQuestionComplete(question, dna) && isBusinessIntakeQuestionSemanticallyEligible(question, dna));
}

export function selectCurrentBusinessIntakeQuestion(input: {
  questions: readonly BusinessIntakeQuestion[];
  dna: BusinessDnaContent;
  currentQuestionId: string | null;
}) {
  const eligible = eligibleBusinessIntakeQuestions(input.questions, input.dna);
  return eligible.find((question) => question.id === input.currentQuestionId) ?? eligible[0] ?? null;
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
