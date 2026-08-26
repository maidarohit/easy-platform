import type { BusinessDnaContent } from "@/app/lib/business-dna";

export type BusinessReviewSection = Readonly<{ id: string; label: string; items: readonly Readonly<{ path: string; label: string; value: string }>[] }>;

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
