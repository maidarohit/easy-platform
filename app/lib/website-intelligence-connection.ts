import type { BusinessDnaContent } from "@/app/lib/business-dna";
import {
  validateBrandingOutput,
  validateSeoOutput,
  validateUiuxOutput,
} from "@/app/lib/easy-mode-execution-contracts";
import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { concisePublicCopy, publicIndustryLabel, publicServiceText, publicServiceTitle } from "@/app/lib/public-website-presentation";
import {
  buildWebsiteEditsFallback,
  diagnoseWebsiteEdits,
  hasUnsafeWebsitePlainText,
  normalizeWebsiteEdits,
  validateWebsiteAiOutput,
  validateWebsiteEdits,
  validateWebsiteTemplate,
} from "@/app/lib/website-publication";
import { buildWebsiteSiteDocumentWithTheme, validateWebsiteSiteDocument } from "@/app/lib/website-site-document";

type ProjectIdentity = Readonly<{
  name: string;
  companyName: string | null;
  industry: string | null;
  brandStyle: string | null;
  brandDescription?: string | null;
  location?: string | null;
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
export type WebsiteIntelligenceFailure = Readonly<{
  ok: false;
  code: "INVALID_EXISTING_WEBSITE" | "INVALID_WEBSITE_EDITS" | "INVALID_MERGED_WEBSITE";
}>;
export type WebsiteDraftNormalizationIssue = Readonly<{
  path: string;
  valueType: string;
  branch: string;
}>;

const PRIVATE_STRATEGY = /\b(?:internal strategy|marketing strategy|sales strategy|seo strategy|lead generation strategy|sales funnel|lead scoring|campaign timeline|content calendar|implementation notes?|sales script|outreach plan|pricing recommendation|target customer profile)\b/i;
const INTERNAL_STRATEGY_LABEL = /(?:^|\n)\s*(?:primary(?:\s+goal|\s+objective|\s+strategy|\s+recommendation)?|proposed\s+recommendation|goal|objective|strategy|recommendation|kpi|funnel|priority)\s*:/i;
const INTERNAL_INSTRUCTION = /\b(?:describe|mention|include|add|state|claim|write)\b.{0,100}\b(?:only when|if|unless)\b/i;
const UNVERIFIED_HISTORY_OR_PROOF = /\b(?:we (?:started|began|were founded)|founded (?:in|by)|small team of|years? of experience|award(?:-winning|s?)|testimonials?|client counts?|guarantee[ds]?|certif(?:ied|ication)|case stud(?:y|ies))\b/i;
const LIST_PREFIX = /^\s*(?:[-*•]+|\d{1,2}[.)])\s*/;
const GENERIC_SAFE_CTA = /^(?:contact(?: us)?|send an enquir(?:y|ies)|send inquiry|learn more|get in touch|enquire|inquire)$/i;

function parse(value: unknown) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

const WEBSITE_FIELDS = [
  "websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures",
  "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations",
] as const;
const LEGACY_WEBSITE_MAX = 20_000;
const CANONICAL_WEBSITE_MAX = 4_000;

function record(value: unknown): Record<string, unknown> | null {
  const parsed = parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function valueType(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function existingWebsiteCandidate(value: unknown) {
  let candidate = record(value);
  if (candidate && !candidate.websiteOverview) {
    for (const field of ["output", "result", "websiteOutput"] as const) {
      const nested = record(candidate[field]);
      if (nested?.websiteOverview) {
        candidate = nested;
        break;
      }
    }
  }
  return candidate;
}

function canonicalWebsiteOutput(candidate: Record<string, unknown>): { website: ReturnType<typeof validateWebsiteAiOutput>; issue: WebsiteDraftNormalizationIssue | null } {
  const canonical: Record<string, unknown> = {};
  for (const field of WEBSITE_FIELDS) {
    const fieldValue = field === "colourScheme" ? candidate[field] ?? candidate.colorScheme : candidate[field];
    if (typeof fieldValue !== "string") {
      return { website: null, issue: { path: field, valueType: valueType(fieldValue), branch: "normalizeExistingWebsite:field-type" } };
    }
    const normalized = fieldValue.trim();
    if (!normalized || normalized.length > LEGACY_WEBSITE_MAX || hasUnsafeWebsitePlainText(normalized)) {
      return { website: null, issue: { path: field, valueType: valueType(fieldValue), branch: "normalizeExistingWebsite:field-value" } };
    }
    canonical[field] = normalized.slice(0, CANONICAL_WEBSITE_MAX).trimEnd();
  }
  const website = validateWebsiteAiOutput(canonical);
  return website
    ? { website, issue: null }
    : { website: null, issue: { path: "website", valueType: "object", branch: "validateWebsiteAiOutput" } };
}

function normalizeExistingWebsite(value: unknown, project: ProjectIdentity) {
  const candidate = existingWebsiteCandidate(value);
  if (!candidate) return null;
  const { website } = canonicalWebsiteOutput(candidate);
  if (!website) return null;
  const fallbackEdits = buildWebsiteEditsFallback({
    companyName: project.companyName ?? project.name,
    template: validateWebsiteTemplate(project.brandStyle) ?? "Modern",
    websiteOutput: website,
    heroHeadline: candidate.heroHeadline,
  });
  const edits = candidate.websiteEdits === undefined
    ? null
    : validateWebsiteEdits(candidate.websiteEdits) ?? normalizeWebsiteEdits(candidate.websiteEdits, fallbackEdits ?? {});
  const siteDocument = candidate.siteDocument === undefined ? null : validateWebsiteSiteDocument(candidate.siteDocument);
  return {
    website,
    edits,
    hadInvalidEdits: candidate.websiteEdits !== undefined && !edits,
    legacyHeroHeadline: typeof candidate.heroHeadline === "string" ? candidate.heroHeadline : null,
    siteDocument,
    hadInvalidSiteDocument: candidate.siteDocument !== undefined && !siteDocument,
  };
}

export function diagnoseWebsiteDraftNormalization(input: Readonly<{
  project: ProjectIdentity;
  website: unknown;
}>): WebsiteDraftNormalizationIssue | null {
  const candidate = existingWebsiteCandidate(input.website);
  if (!candidate) return { path: "website", valueType: valueType(input.website), branch: "normalizeExistingWebsite:parse" };
  const { website, issue } = canonicalWebsiteOutput(candidate);
  if (!website || issue) return issue;
  const fallbackEdits = buildWebsiteEditsFallback({
    companyName: input.project.companyName ?? input.project.name,
    template: validateWebsiteTemplate(input.project.brandStyle) ?? "Modern",
    websiteOutput: website,
    heroHeadline: candidate.heroHeadline,
  });
  if (candidate.websiteEdits !== undefined) {
    const edits = validateWebsiteEdits(candidate.websiteEdits) ?? normalizeWebsiteEdits(candidate.websiteEdits, fallbackEdits ?? {});
    if (!edits) return diagnoseWebsiteEdits(candidate.websiteEdits, fallbackEdits ?? {});
  }
  if (candidate.siteDocument !== undefined && !validateWebsiteSiteDocument(candidate.siteDocument)) {
    return { path: "siteDocument", valueType: valueType(candidate.siteDocument), branch: "validateWebsiteSiteDocument" };
  }
  return null;
}

function publicCopy(value: unknown, maximum = 650) {
  if (typeof value !== "string") return null;
  const candidate = concisePublicCopy(value, maximum);
  return candidate && !INTERNAL_STRATEGY_LABEL.test(candidate) && !PRIVATE_STRATEGY.test(candidate) && !hasUnsupportedPublicClaim(candidate)
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

function publicCta(value: unknown, offerings: readonly string[] = []) {
  const candidate = firstPublicCandidate(value, 80)?.replace(/[.!?]+$/, "").trim();
  if (!candidate || candidate.length > 80) return null;
  if (GENERIC_SAFE_CTA.test(candidate)) return candidate;
  return offerings.some((offering) => candidate.toLowerCase().includes(offering.toLowerCase())) ? candidate : null;
}

function publicUnverifiedAboutCopy(value: unknown, maximum = 1_500) {
  const candidate = publicCopy(value, maximum);
  return candidate && !INTERNAL_INSTRUCTION.test(candidate) && !UNVERIFIED_HISTORY_OR_PROOF.test(candidate)
    ? candidate
    : null;
}

function joinPublic(values: readonly unknown[], maximum = 1_200) {
  const selected = values.map((value) => publicCopy(value, maximum)).filter((value): value is string => Boolean(value));
  if (!selected.length) return null;
  return [...new Set(selected)].join("\n").slice(0, maximum).trimEnd();
}

function joinReadableList(values: readonly string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function confirmedOfferings(dna: BusinessDnaContent | null | undefined, fallbacks: readonly unknown[] = []) {
  const fromDna = [...(dna?.offer?.strongestOffers ?? []), ...(dna?.offer?.services ?? []), ...(dna?.offer?.products ?? [])]
    .map((value) => publicServiceTitle(publicCopy(value, 160)))
    .filter((value): value is string => Boolean(value));
  if (fromDna.length > 0) return [...new Set(fromDna)];

  const fromFallbacks = fallbacks.flatMap((value) => {
    const cleaned = publicServiceText(publicCopy(value, 1_500));
    if (!cleaned) return [];
    return cleaned.split(/(?:\r?\n|;)/)
      .map((part) => publicServiceTitle(part.trim()))
      .filter((item): item is string => Boolean(item));
  });
  return [...new Set(fromFallbacks)];
}

export function restoreWebsiteDraftForEditing(input: Readonly<{
  project: ProjectIdentity;
  website: unknown;
}>) {
  const normalized = normalizeWebsiteDraftForPersistence(input);
  if (normalized) return normalized;
  const candidate = existingWebsiteCandidate(input.website);
  if (!candidate) return null;
  const { website } = canonicalWebsiteOutput(candidate);
  if (!website) return null;
  const fallbackEdits = buildWebsiteEditsFallback({
    companyName: input.project.companyName ?? input.project.name,
    template: validateWebsiteTemplate(input.project.brandStyle) ?? "Modern",
    websiteOutput: website,
    heroHeadline: candidate.heroHeadline,
  });
  const existingEdits = candidate.websiteEdits === undefined
    ? null
    : validateWebsiteEdits(candidate.websiteEdits) ?? normalizeWebsiteEdits(candidate.websiteEdits, fallbackEdits ?? {});
  const companyName = publicCopy(existingEdits?.companyName, 200)
    ?? publicCopy(input.project.companyName, 200)
    ?? input.project.name;
  const websiteEdits = {
    companyName,
    heroHeadline: publicCopy(existingEdits?.heroHeadline, 200)
      ?? publicCopy(candidate.heroHeadline, 200)
      ?? publicCopy(website.websiteGoal, 200)
      ?? fallbackEdits?.heroHeadline
      ?? companyName,
    heroDescription: publicCopy(existingEdits?.heroDescription, 650)
      ?? publicCopy(website.websiteOverview, 650)
      ?? `Contact ${companyName} to ask about current services.`,
    aboutText: publicUnverifiedAboutCopy(existingEdits?.aboutText, 1_500)
      ?? publicUnverifiedAboutCopy(website.websiteOverview, 1_500)
      ?? `Contact ${companyName} to learn more.`,
    servicesText: publicServiceText(publicCopy(existingEdits?.servicesText, 1_500))
      ?? publicServiceText(publicCopy(website.websiteFeatures, 1_500))
      ?? `Contact ${companyName} to ask about current services.`,
    phone: existingEdits?.phone ?? "",
    email: existingEdits?.email ?? "",
    address: existingEdits?.address ?? "",
    whatsapp: existingEdits?.whatsapp ?? "",
    primaryCtaLabel: publicCta(existingEdits?.primaryCtaLabel)
      ?? publicCta(website.websiteGoal)
      ?? "Send an enquiry",
    primaryCtaLink: existingEdits?.primaryCtaLink ?? "#contact",
    template: existingEdits?.template
      ?? validateWebsiteTemplate(input.project.brandStyle)
      ?? "Modern",
  };
  const validatedEdits = validateWebsiteEdits(websiteEdits);
  if (!validatedEdits) return null;
  const siteDocument = candidate.siteDocument === undefined ? null : validateWebsiteSiteDocument(candidate.siteDocument);
  return { ...website, websiteEdits: validatedEdits, ...(siteDocument && { siteDocument }) };
}

export function applyLatestWebsiteIntelligenceDetailed(sources: WebsiteIntelligenceSources) {
  const normalized = normalizeExistingWebsite(sources.website, sources.project);
  if (!normalized) return { ok: false, code: "INVALID_EXISTING_WEBSITE" } as const;
  if (normalized.hadInvalidEdits) return { ok: false, code: "INVALID_WEBSITE_EDITS" } as const;
  if (normalized.hadInvalidSiteDocument) return { ok: false, code: "INVALID_EXISTING_WEBSITE" } as const;
  const { website, edits: existingEdits } = normalized;
  const branding = sources.branding ? validateBrandingOutput(parse(sources.branding)) : null;
  const uiux = sources.uiux ? validateUiuxOutput(parse(sources.uiux)) : null;
  const seo = sources.approvedSeo ? validateSeoOutput(parse(sources.approvedSeo)) : null;
  const dna = sources.businessDna;

  const verifiedProjectDescription = publicCopy(sources.project.brandDescription, 1_500);
  const dnaAbout = publicUnverifiedAboutCopy(dna?.offer?.differentiators?.join(". "), 1_200);
  const template = existingEdits?.template
    ?? validateWebsiteTemplate(sources.project.brandStyle)
    ?? "Modern";
  const companyName = publicCopy(dna?.identity?.businessName, 200)
    ?? existingEdits?.companyName
    ?? publicCopy(sources.project.companyName, 200)
    ?? sources.project.name;
  const industry = publicIndustryLabel(publicCopy(sources.project.industry, 120));
  const offerings = confirmedOfferings(dna, [existingEdits?.servicesText, website.websiteFeatures, website.recommendedPages]);
  const services = offerings.length > 0
    ? offerings.join("; ")
    : publicServiceText(publicCopy(existingEdits?.servicesText, 1_500))
      ?? publicServiceText(publicCopy(website.websiteFeatures, 1_500));
  const naturalHeroDescription = offerings.length > 0
    ? `${companyName} offers ${joinReadableList(offerings.slice(0, 3))}.`
    : industry
      ? `${companyName} offers ${industry.toLowerCase()} services.`
      : `Contact ${companyName} to ask about current services.`;
  const heroDescription = publicCopy(existingEdits?.heroDescription, 650)
    ?? verifiedProjectDescription
    ?? publicCopy(website.websiteOverview, 650)
    ?? naturalHeroDescription;
  const about = publicUnverifiedAboutCopy(existingEdits?.aboutText, 1_500)
    ?? joinPublic([
      verifiedProjectDescription,
      dnaAbout,
      publicUnverifiedAboutCopy(website.websiteOverview, 1_500),
    ], 1_500);
  const cta = publicCta(existingEdits?.primaryCtaLabel, offerings)
    ?? (offerings[0] && `Enquire about ${offerings[0]}`.length <= 80 ? `Enquire about ${offerings[0]}` : null)
    ?? "Send an enquiry";

  const websiteEdits = {
    companyName,
    heroHeadline: publicCopy(existingEdits?.heroHeadline, 200)
      ?? publicCopy(normalized.legacyHeroHeadline, 200)
      ?? (offerings[0] ? `${offerings[0]} from ${companyName}`.slice(0, 200) : null)
      ?? companyName,
    heroDescription,
    aboutText: about ?? publicUnverifiedAboutCopy(existingEdits?.aboutText, 1_500)
      ?? publicUnverifiedAboutCopy(website.websiteOverview, 1_500)
      ?? naturalHeroDescription,
    servicesText: services ?? `Contact ${companyName} to ask about current services.`,
    phone: existingEdits?.phone ?? "",
    email: existingEdits?.email ?? "",
    address: existingEdits?.address ?? "",
    whatsapp: existingEdits?.whatsapp ?? "",
    primaryCtaLabel: cta,
    primaryCtaLink: existingEdits?.primaryCtaLink ?? "#contact",
    template,
  };
  if (!validateWebsiteEdits(websiteEdits)) return { ok: false, code: "INVALID_WEBSITE_EDITS" } as const;

  const merged = {
    ...website,
    websiteOverview: heroDescription,
    websiteGoal: cta,
    websiteFeatures: websiteEdits.servicesText,
    recommendedPages: publicCopy(uiux?.wireframes, 4_000) ?? websiteEdits.servicesText,
    siteStructure: publicCopy(uiux?.userFlow, 4_000) ?? String(website.siteStructure),
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
    seoRecommendations: seo ? joinPublic([
      firstPublicCandidate(seo.metaTitles, 300) ? `Meta title: ${firstPublicCandidate(seo.metaTitles, 300)}` : null,
      firstPublicCandidate(seo.metaDescriptions, 650) ? `Meta description: ${firstPublicCandidate(seo.metaDescriptions, 650)}` : null,
    ], 1_000) ?? "Search metadata pending review."
      : publicUnverifiedAboutCopy(website.seoRecommendations, 1_000) ?? "Search metadata pending review.",
    websiteEdits,
  };
  const validatedOutput = validateWebsiteAiOutput(merged);
  const validatedEdits = validateWebsiteEdits(websiteEdits);
  if (!validatedOutput || !validatedEdits) return { ok: false, code: "INVALID_MERGED_WEBSITE" } as const;
  const syncedSiteDocument = normalized.siteDocument
    ? buildWebsiteSiteDocumentWithTheme({
      siteDocument: normalized.siteDocument,
      companyName,
      template: validatedEdits.template,
      colorPalette: validatedOutput.colourScheme,
      typography: validatedOutput.typography,
      websiteOutput: validatedOutput,
      websiteEdits: validatedEdits,
    })
    : null;
  const output = { ...validatedOutput, websiteEdits: validatedEdits, ...(syncedSiteDocument && { siteDocument: syncedSiteDocument }) };
  const original = { ...website, ...(existingEdits && { websiteEdits: existingEdits }), ...(normalized.siteDocument && { siteDocument: normalized.siteDocument }) };
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
  if (seo && output.seoRecommendations !== website.seoRecommendations) modules.push("SEO");
  if (dna && (
    output.websiteEdits.companyName !== existingEdits?.companyName ||
    (Boolean(dnaAbout) && output.websiteEdits.aboutText !== existingEdits?.aboutText) ||
    (offerings.length > 0 && output.websiteEdits.servicesText !== existingEdits?.servicesText)
  )) modules.push("Business DNA");
  return { ok: true, value: { output, changed: changed(output, original), modules } } as const;
}

export function applyLatestWebsiteIntelligence(sources: WebsiteIntelligenceSources) {
  const result = applyLatestWebsiteIntelligenceDetailed(sources);
  return result.ok ? result.value : null;
}

export function normalizeWebsiteDraftForPersistence(input: Readonly<{
  project: ProjectIdentity;
  website: unknown;
}>) {
  const result = applyLatestWebsiteIntelligenceDetailed({ project: input.project, website: input.website });
  return result.ok ? result.value.output : null;
}
