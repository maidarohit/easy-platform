import type { BusinessDnaContent } from "@/app/lib/business-dna";

export type BusinessReviewSection = Readonly<{ id: string; label: string; items: readonly Readonly<{ path: string; label: string; value: string }>[] }>;

export const BUSINESS_BUILD_DELIVERABLES = [
  "Brand identity and positioning",
  "Services and offer structure",
  "Website and customer-facing copy",
  "Marketing starter content",
  "Search and local visibility foundations",
  "Customer journey and lead path",
  "A practical launch plan",
] as const;

const uncertaintyPattern = /\b(?:don['’]?t know|do not know|not sure|unsure|no idea|haven['’]?t decided|have not decided|help me (?:choose|decide)|need (?:a )?recommendation|recommend (?:it|this|for me)|you (?:decide|suggest))\b/i;

export function isBusinessIntakeUncertainty(value: unknown): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => typeof item === "string" && uncertaintyPattern.test(item));
}

function recommendationContext(dna: BusinessDnaContent) {
  return [dna.identity?.industry, dna.identity?.subIndustry, dna.conversation?.originalVisionText,
    ...(dna.offer?.products ?? []), ...(dna.offer?.services ?? []), ...(dna.offer?.strongestOffers ?? [])]
    .filter(Boolean).join(" ");
}

/** Converts explicit uncertainty into conservative recommendations supported by saved facts. */
export function synthesizeBusinessReviewRecommendations(dna: BusinessDnaContent): BusinessDnaContent {
  const result = structuredClone(dna);
  const context = recommendationContext(dna);
  const location = dna.location?.city?.trim();
  const isVisualArtist = /\b(?:paint(?:er|ing)?|artist|portrait|canvas|mural)\b/i.test(context);

  if (isBusinessIntakeUncertainty(dna.customers?.desiredCustomers) || isBusinessIntakeUncertainty(dna.customers?.targetAudience)) {
    const recommendation = isVisualArtist
      ? `People commissioning custom portraits and personalized art; homeowners seeking canvas artwork; interior designers, cafes, restaurants, offices and other spaces seeking murals or commissioned artwork${location ? ` in ${location}` : ""}`
      : `People and organizations actively looking for ${dna.identity?.industry?.trim() || "the services described"}${location ? ` in ${location}` : ""}`;
    result.customers = { ...result.customers, desiredCustomers: recommendation };
    if (isBusinessIntakeUncertainty(result.customers.targetAudience)) delete result.customers.targetAudience;
  }

  if (isBusinessIntakeUncertainty(dna.offer?.strongestOffers)) {
    const explicitOffers = [...(dna.offer?.services ?? []), ...(dna.offer?.products ?? [])]
      .filter((item) => !isBusinessIntakeUncertainty(item));
    result.offer = { ...result.offer, strongestOffers: isVisualArtist
      ? ["Custom portrait commissions", "Canvas artwork", "Wall murals", "Commercial and interior art commissions"]
      : explicitOffers.length ? explicitOffers : [`A focused starter ${dna.identity?.industry?.trim() || "service"} offer based on your business description`] };
  }
  return result;
}

const sections = [
  ["business", "Your business", [["identity.businessName", "Name"], ["identity.industry", "Industry"], ["identity.businessStage", "Stage"]]],
  ["story", "Your story", [["founderHistory.founderStory", "Story"], ["founderHistory.whyStarted", "Why it began"], ["founderHistory.businessAge", "Business history"]]],
  ["customers", "Your customers", [["customers.currentCustomers", "Current customers"], ["customers.desiredCustomers", "Customers you want"], ["customers.targetAudience", "Target audience"]]],
  ["offer", "What you offer", [["offer.products", "Products"], ["offer.services", "Services"], ["offer.strongestOffers", "Strongest offers"]]],
  ["location", "Where you operate", [["location.city", "Based in"], ["location.serviceAreas", "Service areas"]]],
  ["difference", "What makes you different", [["offer.differentiators", "Why customers choose you"], ["personality.trustSignals", "Trust signals"]]],
  ["goals", "What you want to achieve", [["goals.primaryGoal", "Main goal"], ["goals.sixToTwelveMonthGoal", "6–12 month goal"], ["goals.primaryLeadObjective", "Lead goal"]]],
  ["online", "Your online presence", [["digitalPresence.existingWebsite", "Website"], ["digitalPresence.websiteStatus", "Website priorities"], ["digitalPresence.socialPresence", "Social channels"], ["digitalPresence.digitalProblems", "Online challenges"]]],
] as const;

function rawValueAt(dna: BusinessDnaContent, path: string) {
  const [section, field] = path.split(".");
  return (dna[section as keyof BusinessDnaContent] as Record<string, unknown> | undefined)?.[field];
}

const customerCopy: Readonly<Record<string, string>> = {
  have_portfolio: "Has case studies or testimonials to share",
  no_profiles: "No social profiles yet",
  "established/existing": "Existing / operating business",
  "startup/new": "Starting something new",
};

function customerFacingPart(value: string) {
  const trimmed = value.trim();
  if (customerCopy[trimmed]) return customerCopy[trimmed];
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(trimmed)
    ? `${trimmed.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}`
    : trimmed;
}

function displayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map(customerFacingPart).join(", ")
    : typeof value === "string" ? customerFacingPart(value) : "";
}

export function buildBusinessReviewSections(dna: BusinessDnaContent): BusinessReviewSection[] {
  const portfolioWasStoredAsWebsite = rawValueAt(dna, "digitalPresence.existingWebsite") === "have_portfolio";
  return sections.map(([id, label, fields]) => ({ id, label, items: fields.map(([path, itemLabel]) => {
    const rawValue = rawValueAt(dna, path);
    if (path === "digitalPresence.existingWebsite" && portfolioWasStoredAsWebsite) {
      return { path, label: itemLabel, value: "Does not currently have a proper agency website" };
    }
    return { path, label: itemLabel, value: displayValue(rawValue) };
  }).filter((item) => item.value) }))
    .map((section) => portfolioWasStoredAsWebsite && section.id === "difference"
      ? { ...section, items: [...section.items, { path: "personality.trustSignals", label: "Portfolio / proof", value: customerCopy.have_portfolio }] }
      : section)
    .filter((section) => section.items.length > 0);
}
