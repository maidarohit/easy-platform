export const BUSINESS_DNA_SCHEMA_VERSION = 1 as const;

export type BusinessDnaLanguage = "english" | "hindi" | "hinglish";

export type BusinessDnaContent = {
  identity?: {
    businessName?: string;
    industry?: string;
    subIndustry?: string;
    businessStage?: string;
  };
  founderHistory?: {
    founderStory?: string;
    whyStarted?: string;
    businessAge?: string;
    businessGeneration?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    serviceAreas?: string[];
  };
  offer?: {
    products?: string[];
    services?: string[];
    strongestOffers?: string[];
    differentiators?: string[];
  };
  customers?: {
    currentCustomers?: string;
    desiredCustomers?: string;
    targetAudience?: string;
  };
  digitalPresence?: {
    existingWebsite?: string;
    websiteStatus?: string;
    socialPresence?: string[];
    digitalProblems?: string[];
  };
  personality?: {
    brandPersonality?: string[];
    tone?: string;
    trustSignals?: string[];
  };
  goals?: {
    vision?: string;
    sixToTwelveMonthGoal?: string;
    primaryGoal?: string;
    primaryLeadObjective?: string;
  };
  conversation?: {
    preferredLanguage?: BusinessDnaLanguage;
    originalVisionText?: string;
  };
};

export type BusinessDna = BusinessDnaContent & {
  conversation?: BusinessDnaContent["conversation"] & {
    confirmed: boolean;
    confirmedAt: string | null;
    revisionCount: number;
  };
  metadata: {
    schemaVersion: typeof BUSINESS_DNA_SCHEMA_VERSION;
    createdAt: string;
    updatedAt: string;
  };
};

export type ProjectMemoryCompatibilityProjection = {
  businessName?: string;
  industry?: string;
  businessDescription?: string;
  targetAudience?: string;
  brandStyle?: string;
  brandVoice?: string;
  websiteGoal?: string;
  marketingGoal?: string;
  additionalContext?: string;
};

const MAX_SHORT_LENGTH = 500;
const MAX_LONG_LENGTH = 4_000;
const MAX_LIST_ITEMS = 50;

const sectionFields = {
  identity: ["businessName", "industry", "subIndustry", "businessStage"],
  founderHistory: ["founderStory", "whyStarted", "businessAge", "businessGeneration"],
  location: ["city", "region", "country", "serviceAreas"],
  offer: ["products", "services", "strongestOffers", "differentiators"],
  customers: ["currentCustomers", "desiredCustomers", "targetAudience"],
  digitalPresence: ["existingWebsite", "websiteStatus", "socialPresence", "digitalProblems"],
  personality: ["brandPersonality", "tone", "trustSignals"],
  goals: ["vision", "sixToTwelveMonthGoal", "primaryGoal", "primaryLeadObjective"],
  conversation: ["preferredLanguage", "originalVisionText"],
} as const;

const listFields = new Set([
  "serviceAreas", "products", "services", "strongestOffers", "differentiators",
  "socialPresence", "digitalProblems", "brandPersonality", "trustSignals",
]);
const longFields = new Set([
  "founderStory", "whyStarted", "currentCustomers", "desiredCustomers", "targetAudience",
  "websiteStatus", "vision", "sixToTwelveMonthGoal", "primaryGoal", "primaryLeadObjective",
  "originalVisionText",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim();
}

export function validateBusinessDnaPatch(value: unknown): BusinessDnaContent | null {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).some((key) => !(key in sectionFields))) return null;

  const result: Record<string, Record<string, string | string[]>> = {};
  for (const [section, fields] of Object.entries(sectionFields)) {
    const candidate = value[section];
    if (candidate === undefined) continue;
    if (!isPlainObject(candidate) || Object.keys(candidate).some((key) => !(fields as readonly string[]).includes(key))) {
      return null;
    }
    const cleaned: Record<string, string | string[]> = {};
    for (const field of fields) {
      const item = candidate[field];
      if (item === undefined) continue;
      if (field === "preferredLanguage") {
        if (item !== "english" && item !== "hindi" && item !== "hinglish") return null;
        cleaned[field] = item;
      } else if (listFields.has(field)) {
        if (!Array.isArray(item) || item.length > MAX_LIST_ITEMS) return null;
        const items = item.map((entry) => cleanString(entry, MAX_SHORT_LENGTH));
        if (items.some((entry) => entry === null)) return null;
        cleaned[field] = (items as string[]).filter(Boolean);
      } else {
        const text = field === "originalVisionText" && typeof item === "string" && item.length <= MAX_LONG_LENGTH
          ? item
          : cleanString(item, longFields.has(field) ? MAX_LONG_LENGTH : MAX_SHORT_LENGTH);
        if (text === null) return null;
        cleaned[field] = text;
      }
    }
    result[section] = cleaned;
  }
  return result as BusinessDnaContent;
}

export function mergeBusinessDnaContent(
  current: BusinessDnaContent | null,
  patch: BusinessDnaContent,
): BusinessDnaContent {
  const merged: Record<string, unknown> = { ...(current ?? {}) };
  for (const section of Object.keys(patch) as (keyof BusinessDnaContent)[]) {
    merged[section] = { ...(current?.[section] ?? {}), ...(patch[section] ?? {}) };
  }
  return merged as BusinessDnaContent;
}

const join = (items: readonly (string | undefined)[], separator = ", ") =>
  items.map((item) => item?.trim()).filter(Boolean).join(separator);

function bounded(value: string, length: number) {
  return value.length <= length ? value : value.slice(0, length).trimEnd();
}

export function projectBusinessDnaToProjectMemory(
  dna: BusinessDnaContent,
): ProjectMemoryCompatibilityProjection {
  const description = join([
    dna.founderHistory?.founderStory,
    dna.founderHistory?.whyStarted,
    dna.offer?.products?.length ? `Products: ${join(dna.offer.products)}` : undefined,
    dna.offer?.services?.length ? `Services: ${join(dna.offer.services)}` : undefined,
    dna.offer?.strongestOffers?.length ? `Strongest offers: ${join(dna.offer.strongestOffers)}` : undefined,
    dna.offer?.differentiators?.length ? `Differentiators: ${join(dna.offer.differentiators)}` : undefined,
  ], "\n");
  const context = join([
    join([dna.identity?.subIndustry, dna.identity?.businessStage], "; "),
    join([dna.founderHistory?.businessAge, dna.founderHistory?.businessGeneration], "; "),
    join([dna.location?.city, dna.location?.region, dna.location?.country]),
    dna.location?.serviceAreas?.length ? `Service areas: ${join(dna.location.serviceAreas)}` : undefined,
    dna.digitalPresence?.existingWebsite ? `Website: ${dna.digitalPresence.existingWebsite}` : undefined,
    dna.digitalPresence?.websiteStatus,
    dna.digitalPresence?.socialPresence?.length ? `Social presence: ${join(dna.digitalPresence.socialPresence)}` : undefined,
    dna.digitalPresence?.digitalProblems?.length ? `Digital problems: ${join(dna.digitalPresence.digitalProblems)}` : undefined,
    dna.personality?.trustSignals?.length ? `Trust signals: ${join(dna.personality.trustSignals)}` : undefined,
    dna.goals?.vision,
  ], "\n");
  const projection: ProjectMemoryCompatibilityProjection = {
    businessName: dna.identity?.businessName?.trim(),
    industry: dna.identity?.industry?.trim(),
    businessDescription: description ? bounded(description, MAX_LONG_LENGTH) : undefined,
    targetAudience: dna.customers?.targetAudience?.trim() || dna.customers?.desiredCustomers?.trim() || dna.customers?.currentCustomers?.trim(),
    brandStyle: dna.personality?.brandPersonality?.length ? bounded(join(dna.personality.brandPersonality), MAX_SHORT_LENGTH) : undefined,
    brandVoice: dna.personality?.tone?.trim(),
    websiteGoal: dna.goals?.primaryLeadObjective?.trim() || dna.goals?.primaryGoal?.trim(),
    marketingGoal: dna.goals?.sixToTwelveMonthGoal?.trim() || dna.goals?.primaryGoal?.trim(),
    additionalContext: context ? bounded(context, MAX_LONG_LENGTH) : undefined,
  };
  return Object.fromEntries(Object.entries(projection).filter(([, value]) => value)) as ProjectMemoryCompatibilityProjection;
}

export function materializeBusinessDna(input: {
  content: BusinessDnaContent;
  confirmed: boolean;
  confirmedAt: Date | null;
  revisionCount: number;
  createdAt: Date;
  updatedAt: Date;
}): BusinessDna {
  return {
    ...input.content,
    conversation: {
      ...(input.content.conversation ?? {}),
      confirmed: input.confirmed,
      confirmedAt: input.confirmedAt?.toISOString() ?? null,
      revisionCount: input.revisionCount,
    },
    metadata: {
      schemaVersion: BUSINESS_DNA_SCHEMA_VERSION,
      createdAt: input.createdAt.toISOString(),
      updatedAt: input.updatedAt.toISOString(),
    },
  };
}
