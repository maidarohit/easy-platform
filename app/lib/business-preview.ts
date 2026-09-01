export const BUSINESS_PREVIEW_MODULES = [
  "ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales",
] as const;

export type BusinessPreviewModule = (typeof BUSINESS_PREVIEW_MODULES)[number];
type Output = Readonly<Record<string, unknown>>;

export type BusinessPreviewSource = Readonly<{
  project: Readonly<{
    id: string;
    name: string;
    companyName: string | null;
    industry: string | null;
    goal: string | null;
    businessDescription: string | null;
  }>;
  outputs: ReadonlyMap<string, Readonly<{ id: string | null; output: Output; approvedAt: Date | null }>>;
}>;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const BUSINESS_NAME_PLACEHOLDER = /\[(?:brand|company|business)\s+name\]/gi;
const BRACKET_PLACEHOLDER = /\[[^\]\r\n]{1,80}\]/g;

export function resolveCustomerText(value: unknown, businessName: string) {
  const source = text(value);
  if (!source) return null;
  const resolved = source.replace(BUSINESS_NAME_PLACEHOLDER, businessName).replace(BRACKET_PLACEHOLDER, "")
    .replace(/\s{2,}/g, " ").replace(/\s+([,.;:—–-])/g, "$1").trim();
  return resolved || null;
}

function excerpt(value: unknown, businessName: string, maximum = 420) {
  const valueText = resolveCustomerText(value, businessName);
  if (!valueText) return null;
  return valueText.length <= maximum ? valueText : `${valueText.slice(0, maximum).trimEnd()}…`;
}

function nested(output: Output | undefined, key: string) {
  const value = output?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Output : undefined;
}

export function extractBrandColours(value: unknown) {
  const palette = text(value);
  if (!palette) return [];
  return [...new Set(palette.match(/#[0-9a-f]{6}\b/gi) ?? [])].slice(0, 8).map((hex) => hex.toUpperCase());
}

const LIST_MARKER = /^\s*(?:[-*•]+|\d{1,2}[.)])\s*/;

export function cleanFirstListCandidate(value: unknown) {
  const source = text(value);
  if (!source) return null;
  const candidates = source
    .split(/(?:\r?\n|;|\s+(?=\d{1,2}[.)]\s))/)
    .map((candidate) => candidate.replace(LIST_MARKER, "").trim())
    .filter(Boolean);
  return candidates[0] ?? null;
}

export function parsePreviewCards(value: unknown, maximum = 6) {
  const source = text(value);
  if (!source) return [];
  const items = source.split(/(?:\r?\n|;|\s+(?=\d{1,2}[.)]\s))/)
    .map((item) => item.replace(LIST_MARKER, "").trim()).filter(Boolean);
  const cards = items.map((item) => {
    const parts = item.match(/^([^:—–]{2,80})\s*(?::|—|–)\s*(.+)$/);
    return parts ? { title: parts[1].trim(), description: parts[2].trim() } : null;
  }).filter((card): card is { title: string; description: string } => Boolean(card));
  return cards.length >= 3 ? cards.slice(0, maximum) : [];
}

export function parseDisplayItems(value: unknown, maximum = 6) {
  const source = text(value);
  if (!source) return [];
  const items = source.split(/(?:\r?\n|;|\s+(?=\d{1,2}[.)]\s))/)
    .map((item) => item.replace(LIST_MARKER, "").trim()).filter(Boolean);
  return (items.length > 1 ? items : [source]).slice(0, maximum);
}

export function parseKeywordTags(value: unknown, maximum = 16) {
  const source = text(value);
  if (!source) return [];
  return [...new Set(source.split(/(?:[,;\r\n]+|\s+(?=\d{1,2}[.)]\s))/)
    .map((item) => item.replace(LIST_MARKER, "").trim())
    .filter((item) => item.length >= 2 && item.length <= 80))].slice(0, maximum);
}

export function buildBusinessPreview(source: BusinessPreviewSource) {
  const branding = source.outputs.get("branding")?.output;
  const website = source.outputs.get("website")?.output;
  const marketing = source.outputs.get("marketing")?.output;
  const seo = source.outputs.get("seo")?.output;
  const uiux = source.outputs.get("uiux")?.output;
  const sales = source.outputs.get("sales")?.output;
  const projectName = text(source.project.companyName) || text(source.project.name) || "Business";
  const brandingName = text(branding?.brandName);
  const businessName = brandingName && !BRACKET_PLACEHOLDER.test(brandingName) ? brandingName : projectName;
  BRACKET_PLACEHOLDER.lastIndex = 0;
  const displayText = (value: unknown) => resolveCustomerText(value, businessName);
  const displayExcerpt = (value: unknown, maximum = 420) => excerpt(value, businessName, maximum);
  const websiteEdits = nested(website, "websiteEdits");
  const outputIds = BUSINESS_PREVIEW_MODULES
    .map((module) => source.outputs.get(module)?.id)
    .filter((id): id is string => Boolean(id));
  const approved = outputIds.length > 0 && BUSINESS_PREVIEW_MODULES
    .filter((module) => source.outputs.get(module)?.id)
    .every((module) => Boolean(source.outputs.get(module)?.approvedAt));

  return {
    projectId: source.project.id,
    business: {
      name: businessName,
      industry: displayText(source.project.industry),
      goal: displayText(source.project.goal),
      description: displayExcerpt(source.project.businessDescription, 650),
    },
    brand: branding ? {
      name: businessName,
      tagline: displayText(branding.tagline),
      colours: extractBrandColours(branding.colorPalette),
      colourDirection: displayExcerpt(branding.colorPalette, 500),
      typography: displayExcerpt(branding.typography, 500),
      voice: displayExcerpt(branding.brandVoice, 650),
      logoConcept: displayExcerpt(branding.logoConcept, 650),
      story: displayExcerpt(branding.story, 800),
    } : null,
    website: website ? {
      heroHeadline: displayText(websiteEdits?.heroHeadline) || displayText(branding?.tagline),
      supportingText: displayExcerpt(websiteEdits?.heroDescription || website.websiteOverview, 650),
      primaryCta: displayText(websiteEdits?.primaryCtaLabel),
      services: displayText(websiteEdits?.servicesText || website.recommendedPages),
      serviceCards: parsePreviewCards(displayText(websiteEdits?.servicesText || website.recommendedPages)),
      trust: displayExcerpt(branding?.marketingSuggestions, 650),
      about: displayExcerpt(websiteEdits?.aboutText || branding?.story, 900),
      features: displayExcerpt(website.websiteFeatures, 800),
      contact: displayText(websiteEdits?.email) || displayText(websiteEdits?.phone) || displayText(websiteEdits?.whatsapp),
      heroImage: null as string | null,
      secondaryImage: null as string | null,
      businessVideo: null as string | null,
    } : null,
    marketing: marketing ? {
      positioning: displayText(marketing.marketingStrategy),
      campaign: displayText(marketing.campaignTimeline || marketing.paidAdsStrategy),
      audience: displayText(marketing.targetAudienceAnalysis),
      socialCards: [marketing.contentIdeas, marketing.socialMediaStrategy, marketing.adCopy]
        .map(displayText).filter((item): item is string => Boolean(item)),
      campaignCards: [],
      sections: [
        ["contentIdeas", "Content ideas"], ["socialMediaStrategy", "Social media strategy"],
        ["contentCalendar", "Content calendar"], ["emailMarketing", "Email marketing"],
        ["paidAdsStrategy", "Paid advertising"], ["seoRecommendations", "Search recommendations"],
        ["kpis", "Success measures"], ["growthRecommendations", "Growth recommendations"],
        ["adCopy", "Advertising message"], ["bestChannels", "Priority channels"],
        ["campaignTimeline", "Campaign timeline"], ["customerJourney", "Customer journey"],
        ["contentMix", "Content mix"], ["funnelSuggestions", "Funnel recommendations"],
      ].map(([key, label]) => ({ key, label, value: displayText(marketing[key]) }))
        .filter((section): section is { key: string; label: string; value: string } => Boolean(section.value)),
    } : null,
    search: seo ? {
      positioning: displayExcerpt(seo.seoStrategy || seo.seoAudit, 850),
      keywords: displayText(seo.keywords || seo.keywordResearch),
      keywordTags: parseKeywordTags(displayText(seo.keywords || seo.keywordResearch)),
      localFocus: displayExcerpt(seo.growthRecommendations, 650),
      title: displayText(cleanFirstListCandidate(seo.metaTitles)),
      description: displayText(cleanFirstListCandidate(seo.metaDescriptions)),
    } : null,
    journey: sales || uiux ? {
      leadAction: displayExcerpt(sales?.leadGenerationStrategy, 750),
      enquiryPath: displayExcerpt(sales?.salesFunnel || uiux?.userFlow, 900),
      primaryCta: displayExcerpt(sales?.outreachStrategy, 500),
      customerJourney: displayExcerpt(uiux?.userFlow || sales?.actionPlan, 900),
      audience: displayExcerpt(sales?.targetCustomerProfile || uiux?.userPersonas, 750),
    } : null,
    approval: { approved, outputIds },
  };
}

export type BusinessPreview = ReturnType<typeof buildBusinessPreview>;
