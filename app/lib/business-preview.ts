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

function excerpt(value: unknown, maximum = 420) {
  const valueText = text(value);
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

export function buildBusinessPreview(source: BusinessPreviewSource) {
  const branding = source.outputs.get("branding")?.output;
  const website = source.outputs.get("website")?.output;
  const marketing = source.outputs.get("marketing")?.output;
  const seo = source.outputs.get("seo")?.output;
  const uiux = source.outputs.get("uiux")?.output;
  const sales = source.outputs.get("sales")?.output;
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
      name: source.project.companyName || source.project.name,
      industry: source.project.industry,
      goal: source.project.goal,
      description: excerpt(source.project.businessDescription, 650),
    },
    brand: branding ? {
      name: text(branding.brandName) || source.project.companyName || source.project.name,
      tagline: text(branding.tagline),
      colours: extractBrandColours(branding.colorPalette),
      colourDirection: excerpt(branding.colorPalette, 500),
      typography: excerpt(branding.typography, 500),
      voice: excerpt(branding.brandVoice, 650),
      logoConcept: excerpt(branding.logoConcept, 650),
      story: excerpt(branding.story, 800),
    } : null,
    website: website ? {
      heroHeadline: text(websiteEdits?.heroHeadline) || text(branding?.tagline),
      supportingText: excerpt(websiteEdits?.heroDescription || website.websiteOverview, 650),
      primaryCta: text(websiteEdits?.primaryCtaLabel),
      services: excerpt(websiteEdits?.servicesText || website.recommendedPages, 900),
      trust: excerpt(branding?.marketingSuggestions, 650),
      about: excerpt(websiteEdits?.aboutText || branding?.story, 900),
      features: excerpt(website.websiteFeatures, 800),
      contact: text(websiteEdits?.email) || text(websiteEdits?.phone) || text(websiteEdits?.whatsapp),
    } : null,
    marketing: marketing ? {
      positioning: excerpt(marketing.marketingStrategy, 850),
      campaign: excerpt(marketing.campaignTimeline || marketing.paidAdsStrategy, 750),
      audience: excerpt(marketing.targetAudienceAnalysis, 750),
      socialCards: [marketing.contentIdeas, marketing.socialMediaStrategy, marketing.adCopy]
        .map((item) => excerpt(item, 500)).filter((item): item is string => Boolean(item)),
    } : null,
    search: seo ? {
      positioning: excerpt(seo.seoStrategy || seo.seoAudit, 850),
      keywords: excerpt(seo.keywords || seo.keywordResearch, 650),
      localFocus: excerpt(seo.growthRecommendations, 650),
      title: excerpt(seo.metaTitles, 180),
      description: excerpt(seo.metaDescriptions, 320),
    } : null,
    journey: sales || uiux ? {
      leadAction: excerpt(sales?.leadGenerationStrategy, 750),
      enquiryPath: excerpt(sales?.salesFunnel || uiux?.userFlow, 900),
      primaryCta: excerpt(sales?.outreachStrategy, 500),
      customerJourney: excerpt(uiux?.userFlow || sales?.actionPlan, 900),
      audience: excerpt(sales?.targetCustomerProfile || uiux?.userPersonas, 750),
    } : null,
    approval: { approved, outputIds },
  };
}

export type BusinessPreview = ReturnType<typeof buildBusinessPreview>;
