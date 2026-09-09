import type { BusinessDnaContent } from "@/app/lib/business-dna";
import {
  validateBrandingOutput,
  validateContentOutput,
  validateMarketingOutput,
  validateSeoOutput,
  validateSalesOutput,
  validateUiuxOutput,
} from "@/app/lib/easy-mode-execution-contracts";
import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { concisePublicCopy, publicServiceText } from "@/app/lib/public-website-presentation";
import { validateWebsiteAiOutput, validateWebsiteEdits, validateWebsiteTemplate } from "@/app/lib/website-publication";

type ProjectIdentity = Readonly<{
  name: string;
  companyName: string | null;
  industry: string | null;
  brandStyle: string | null;
}>;

export type WebsiteIntelligenceSources = Readonly<{
  project: ProjectIdentity;
  website: unknown;
  businessDna?: BusinessDnaContent | null;
  branding?: unknown;
  uiux?: unknown;
  approvedSeo?: unknown;
  approvedMarketing?: unknown;
  approvedSales?: unknown;
  approvedContent?: unknown;
  approvedSocial?: readonly Readonly<{ content: string; recommendedAction?: string | null }>[];
}>;

export const WEBSITE_INTELLIGENCE_MODULES = [
  "Branding", "UI/UX", "SEO", "Marketing", "Sales", "Social/Content", "Business DNA",
] as const;
export type WebsiteIntelligenceModule = (typeof WEBSITE_INTELLIGENCE_MODULES)[number];

const PRIVATE_STRATEGY = /\b(?:strategy|funnel|kpi|campaign timeline|content calendar|lead scoring|internal|implementation|sales script|outreach plan|pricing recommendation|target customer profile)\b/i;
const LIST_PREFIX = /^\s*(?:[-*•]+|\d{1,2}[.)])\s*/;

function parse(value: unknown) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function publicCopy(value: unknown, maximum = 650) {
  if (typeof value !== "string") return null;
  const candidate = concisePublicCopy(value, maximum);
  return candidate && !PRIVATE_STRATEGY.test(candidate) && !hasUnsupportedPublicClaim(candidate)
    ? candidate
    : null;
}

function firstPublicCandidate(value: unknown, maximum = 200) {
  if (typeof value !== "string") return null;
  for (const part of value.split(/\r?\n|;/)) {
    const candidate = publicCopy(part.replace(LIST_PREFIX, "").replace(/^(?:meta (?:title|description)|cta)\s*:\s*/i, ""), maximum);
    if (candidate) return candidate;
  }
  return null;
}

function publicCta(value: unknown) {
  const candidate = firstPublicCandidate(value, 80)?.replace(/[.!?]+$/, "").trim();
  return candidate && candidate.length <= 80 ? candidate : null;
}

function joinPublic(values: readonly unknown[], maximum = 1_200) {
  const selected = values.map((value) => publicCopy(value, maximum)).filter((value): value is string => Boolean(value));
  if (!selected.length) return null;
  return [...new Set(selected)].join("\n").slice(0, maximum).trimEnd();
}

function dnaServices(dna: BusinessDnaContent | null | undefined) {
  const values = [...(dna?.offer?.services ?? []), ...(dna?.offer?.products ?? []), ...(dna?.offer?.strongestOffers ?? [])]
    .map((value) => publicCopy(value, 300)).filter((value): value is string => Boolean(value));
  return values.length ? publicServiceText([...new Set(values)].join("\n"))?.slice(0, 1_200) || null : null;
}

export function applyLatestWebsiteIntelligence(sources: WebsiteIntelligenceSources) {
  const rawWebsite = parse(sources.website);
  const website = validateWebsiteAiOutput(rawWebsite);
  if (!website) return null;
  const branding = sources.branding ? validateBrandingOutput(parse(sources.branding)) : null;
  const uiux = sources.uiux ? validateUiuxOutput(parse(sources.uiux)) : null;
  const seo = sources.approvedSeo ? validateSeoOutput(parse(sources.approvedSeo)) : null;
  const marketing = sources.approvedMarketing ? validateMarketingOutput(parse(sources.approvedMarketing)) : null;
  const sales = sources.approvedSales ? validateSalesOutput(parse(sources.approvedSales)) : null;
  const content = sources.approvedContent ? validateContentOutput(parse(sources.approvedContent)) : null;
  const existingEdits = rawWebsite && typeof rawWebsite === "object" && !Array.isArray(rawWebsite) && "websiteEdits" in rawWebsite
    ? validateWebsiteEdits(rawWebsite.websiteEdits)
    : null;
  const dna = sources.businessDna;

  const socialCopy = joinPublic((sources.approvedSocial ?? []).map((post) => post.content), 650);
  const socialCta = (sources.approvedSocial ?? []).map((post) => publicCta(post.recommendedAction)).find(Boolean) ?? null;
  const marketingCopy = publicCopy(marketing?.adCopy, 650);
  const marketingCta = publicCta(marketing?.adCopy);
  const contentCopy = publicCopy(content?.content, 650);
  const seoDescription = firstPublicCandidate(seo?.metaDescriptions, 650);
  const dnaAbout = joinPublic([
    dna?.founderHistory?.founderStory,
    dna?.founderHistory?.whyStarted,
    dna?.offer?.differentiators?.join(". "),
  ], 1_200);
  const about = joinPublic([dnaAbout, branding?.story, contentCopy], 1_500);
  const services = joinPublic([dnaServices(dna), sales?.proposal], 1_500);
  const cta = socialCta
    ?? marketingCta
    ?? existingEdits?.primaryCtaLabel
    ?? "Contact us";
  const template = existingEdits?.template
    ?? validateWebsiteTemplate(sources.project.brandStyle)
    ?? "Modern";
  const companyName = publicCopy(dna?.identity?.businessName, 200)
    ?? existingEdits?.companyName
    ?? publicCopy(sources.project.companyName, 200)
    ?? sources.project.name;
  const heroDescription = seoDescription ?? marketingCopy ?? socialCopy ?? contentCopy
    ?? existingEdits?.heroDescription ?? String(website.websiteOverview);

  const websiteEdits = {
    companyName,
    heroHeadline: existingEdits?.heroHeadline ?? firstPublicCandidate(seo?.metaTitles, 200)
      ?? String(website.websiteGoal),
    heroDescription,
    aboutText: about ?? existingEdits?.aboutText ?? String(website.designRecommendations),
    servicesText: services ?? existingEdits?.servicesText ?? String(website.websiteFeatures),
    phone: existingEdits?.phone ?? "",
    email: existingEdits?.email ?? "",
    address: existingEdits?.address ?? "",
    whatsapp: existingEdits?.whatsapp ?? "",
    primaryCtaLabel: cta,
    primaryCtaLink: existingEdits?.primaryCtaLink ?? "#contact",
    template,
  };
  if (!validateWebsiteEdits(websiteEdits)) return null;

  const merged = {
    ...website,
    websiteOverview: heroDescription,
    websiteGoal: cta,
    ...(uiux?.userFlow && { siteStructure: String(uiux.userFlow) }),
    ...(uiux?.wireframes && { recommendedPages: String(uiux.wireframes) }),
    designRecommendations: joinPublic([
      branding?.brandStyleGuide,
      branding?.brandVoice ? `Brand voice: ${branding.brandVoice}` : null,
      uiux?.designSystem,
      uiux?.desktopExperience,
      uiux?.mobileExperience,
      uiux?.uiuxStrategy,
      uiux?.userFlow,
    ], 4_000) ?? String(website.designRecommendations),
    ...(branding?.colorPalette && { colourScheme: String(branding.colorPalette) }),
    ...(branding?.typography && { typography: String(branding.typography) }),
    ...(seo && { seoRecommendations: joinPublic([
      firstPublicCandidate(seo.metaTitles, 300) ? `Meta title: ${firstPublicCandidate(seo.metaTitles, 300)}` : null,
      firstPublicCandidate(seo.metaDescriptions, 650) ? `Meta description: ${firstPublicCandidate(seo.metaDescriptions, 650)}` : null,
    ], 1_000) ?? String(website.seoRecommendations) }),
    websiteEdits,
  };
  const validatedOutput = validateWebsiteAiOutput(merged);
  const validatedEdits = validateWebsiteEdits(websiteEdits);
  if (!validatedOutput || !validatedEdits) return null;
  const output = { ...validatedOutput, websiteEdits: validatedEdits };
  const original = { ...website, ...(existingEdits && { websiteEdits: existingEdits }) };
  const modules: WebsiteIntelligenceModule[] = [];
  const changed = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);
  if (branding && (
    output.colourScheme !== website.colourScheme || output.typography !== website.typography ||
    (Boolean(publicCopy(branding.brandStyleGuide) || publicCopy(branding.brandVoice) || publicCopy(branding.story)) &&
      (output.designRecommendations !== website.designRecommendations || output.websiteEdits.aboutText !== existingEdits?.aboutText))
  )) modules.push("Branding");
  if (uiux && (
    output.siteStructure !== website.siteStructure || output.recommendedPages !== website.recommendedPages ||
    (Boolean(joinPublic([uiux.designSystem, uiux.desktopExperience, uiux.mobileExperience, uiux.uiuxStrategy, uiux.userFlow])) &&
      output.designRecommendations !== website.designRecommendations)
  )) modules.push("UI/UX");
  if (seo && (
    output.seoRecommendations !== website.seoRecommendations ||
    (seoDescription === heroDescription && heroDescription !== existingEdits?.heroDescription)
  )) modules.push("SEO");
  if (marketing && (
    (marketingCopy === heroDescription && heroDescription !== existingEdits?.heroDescription) ||
    (marketingCta === cta && cta !== existingEdits?.primaryCtaLabel)
  )) modules.push("Marketing");
  if (sales && publicCopy(sales.proposal) && output.websiteEdits.servicesText !== existingEdits?.servicesText) modules.push("Sales");
  if ((socialCopy === heroDescription && heroDescription !== existingEdits?.heroDescription) ||
      (Boolean(contentCopy) && output.websiteEdits.aboutText !== existingEdits?.aboutText) ||
      (socialCta === cta && cta !== existingEdits?.primaryCtaLabel)) modules.push("Social/Content");
  if (dna && (
    output.websiteEdits.companyName !== existingEdits?.companyName ||
    (Boolean(dnaAbout) && output.websiteEdits.aboutText !== existingEdits?.aboutText) ||
    (Boolean(dnaServices(dna)) && output.websiteEdits.servicesText !== existingEdits?.servicesText)
  )) modules.push("Business DNA");
  return { output, changed: modules.length > 0 && changed(output, original), modules };
}
