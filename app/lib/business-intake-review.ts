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

function valueAt(dna: BusinessDnaContent, path: string) {
  const [section, field] = path.split(".");
  const value = (dna[section as keyof BusinessDnaContent] as Record<string, unknown> | undefined)?.[field];
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : typeof value === "string" ? value.trim() : "";
}

export function buildBusinessReviewSections(dna: BusinessDnaContent): BusinessReviewSection[] {
  return sections.map(([id, label, fields]) => ({ id, label, items: fields.map(([path, itemLabel]) => ({ path, label: itemLabel, value: valueAt(dna, path) })).filter((item) => item.value) }))
    .filter((section) => section.items.length > 0);
}
