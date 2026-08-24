import "server-only";

export const WEBSITE_TEMPLATES = [
  "Modern",
  "Luxury",
  "Corporate",
  "Creative",
  "Minimal",
  "Dark",
] as const;

export type WebsiteTemplate = (typeof WEBSITE_TEMPLATES)[number];

const OUTPUT_FIELDS = [
  "websiteOverview",
  "websiteGoal",
  "recommendedPages",
  "siteStructure",
  "websiteFeatures",
  "designRecommendations",
  "colourScheme",
  "typography",
  "recommendedTechStack",
  "seoRecommendations",
] as const;

export type WebsitePublicationSnapshot = {
  schemaVersion: 1;
  companyName: string;
  industry: string;
  websiteGoal: string;
  websiteRequirements: string;
  template: WebsiteTemplate;
  websiteOutput: Record<(typeof OUTPUT_FIELDS)[number], string>;
  websiteEdits?: WebsiteEdits;
};

export type WebsiteEdits = {
  companyName: string;
  heroHeadline: string;
  heroDescription: string;
  aboutText: string;
  servicesText: string;
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  primaryCtaLabel: string;
  primaryCtaLink: string;
  template: WebsiteTemplate;
};

export const RESERVED_WEBSITE_SLUGS = new Set([
  "admin", "api", "assets", "billing", "boss", "contact-support", "dashboard",
  "favicon", "forgot-password", "help", "login", "logout", "onboarding",
  "privacy", "published-sites", "refund-cancellation", "robots", "signup",
  "sitemap", "support", "terms", "verify-email", "www", "_next",
]);

const MAX_SHORT = 200;
const MAX_LONG = 4_000;
const FORBIDDEN_CONTENT = /<\/?[a-z][^>]*>|(?:javascript|vbscript|data|file)\s*:/i;
const EDIT_FIELDS = [
  "companyName", "heroHeadline", "heroDescription", "aboutText", "servicesText",
  "phone", "email", "address", "whatsapp", "primaryCtaLabel", "primaryCtaLink", "template",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeString(value: unknown, max: number, required = true): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max || FORBIDDEN_CONTENT.test(normalized)) {
    return null;
  }
  return normalized;
}

export function validateWebsiteTemplate(value: unknown): WebsiteTemplate | null {
  return typeof value === "string" && WEBSITE_TEMPLATES.includes(value as WebsiteTemplate)
    ? value as WebsiteTemplate
    : null;
}

export function normalizeWebsiteSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63)
    .replace(/-$/g, "");
}

export function validateWebsiteSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 63) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (RESERVED_WEBSITE_SLUGS.has(slug)) return null;
  return slug;
}

export function suggestWebsiteSlug(value: string): string {
  const base = normalizeWebsiteSlug(value);
  if (base.length >= 3 && !RESERVED_WEBSITE_SLUGS.has(base)) return base;
  return `site-${base || "business"}`.slice(0, 63).replace(/-$/g, "");
}

export function validateWebsiteAiOutput(value: unknown): WebsitePublicationSnapshot["websiteOutput"] | null {
  if (!isPlainObject(value) || Object.keys(value).some((key) => key !== "websiteEdits" && !OUTPUT_FIELDS.includes(key as never))) {
    return null;
  }
  const output = {} as WebsitePublicationSnapshot["websiteOutput"];
  for (const field of OUTPUT_FIELDS) {
    const item = safeString(value[field], MAX_LONG);
    if (item === null) return null;
    output[field] = item;
  }
  return output;
}

export function validateWebsiteEdits(value: unknown): WebsiteEdits | null {
  if (!isPlainObject(value) || Object.keys(value).some((key) => !EDIT_FIELDS.includes(key as never))) return null;
  if (EDIT_FIELDS.some((field) => !(field in value))) return null;
  const template = validateWebsiteTemplate(value.template);
  const companyName = safeString(value.companyName, MAX_SHORT);
  const heroHeadline = safeString(value.heroHeadline, MAX_SHORT);
  const heroDescription = safeString(value.heroDescription, MAX_LONG);
  const aboutText = safeString(value.aboutText, MAX_LONG);
  const servicesText = safeString(value.servicesText, MAX_LONG);
  const phone = safeString(value.phone, MAX_SHORT, false);
  const email = safeString(value.email, MAX_SHORT, false);
  const address = safeString(value.address, MAX_LONG, false);
  const whatsapp = safeString(value.whatsapp, MAX_SHORT, false);
  const primaryCtaLabel = safeString(value.primaryCtaLabel, MAX_SHORT);
  const primaryCtaLink = safeString(value.primaryCtaLink, MAX_SHORT);
  if (!template || companyName === null || heroHeadline === null || heroDescription === null ||
      aboutText === null || servicesText === null || phone === null || email === null ||
      address === null || whatsapp === null || primaryCtaLabel === null || primaryCtaLink === null) return null;
  if (!/^(?:https?:\/\/|mailto:|tel:|\/|#)[^\s]*$/i.test(primaryCtaLink)) return null;
  return { companyName, heroHeadline, heroDescription, aboutText, servicesText, phone, email, address, whatsapp, primaryCtaLabel, primaryCtaLink, template };
}

export function buildWebsitePublicationSnapshot(input: {
  companyName: unknown;
  industry: unknown;
  websiteGoal: unknown;
  websiteRequirements: unknown;
  template: unknown;
  websiteOutput: unknown;
  websiteEdits?: unknown;
}): WebsitePublicationSnapshot | null {
  const companyName = safeString(input.companyName, MAX_SHORT);
  const industry = safeString(input.industry, MAX_SHORT);
  const websiteGoal = safeString(input.websiteGoal, MAX_SHORT, false);
  const websiteRequirements = safeString(input.websiteRequirements, MAX_LONG, false);
  const template = validateWebsiteTemplate(input.template);
  const websiteOutput = validateWebsiteAiOutput(input.websiteOutput);
  const websiteEdits = input.websiteEdits === undefined ? undefined : validateWebsiteEdits(input.websiteEdits);
  if (companyName === null || industry === null || websiteGoal === null ||
      websiteRequirements === null || !template || !websiteOutput || (input.websiteEdits !== undefined && !websiteEdits)) return null;
  return { schemaVersion: 1, companyName, industry, websiteGoal, websiteRequirements, template, websiteOutput, ...(websiteEdits && { websiteEdits }) };
}

export function validateWebsitePublicationSnapshot(value: unknown): WebsitePublicationSnapshot | null {
  if (!isPlainObject(value)) return null;
  const expected = ["schemaVersion", "companyName", "industry", "websiteGoal", "websiteRequirements", "template", "websiteOutput", "websiteEdits"];
  if (Object.keys(value).some((key) => !expected.includes(key)) || value.schemaVersion !== 1) return null;
  return buildWebsitePublicationSnapshot({
    companyName: value.companyName,
    industry: value.industry,
    websiteGoal: value.websiteGoal,
    websiteRequirements: value.websiteRequirements,
    template: value.template,
    websiteOutput: value.websiteOutput,
    websiteEdits: value.websiteEdits,
  });
}

type PublicationMutationBody = { projectId: string; slug?: string; template?: WebsiteTemplate };

export function validatePublicationMutationBody(
  value: unknown,
  action: "publish" | "republish" | "unpublish",
): PublicationMutationBody | null {
  if (!isPlainObject(value)) return null;
  const allowed = action === "publish" ? ["projectId", "slug", "template"] : ["projectId"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  const projectId = safeString(value.projectId, 128);
  if (!projectId) return null;
  if (action !== "publish") return { projectId };
  const slug = validateWebsiteSlug(value.slug);
  const template = validateWebsiteTemplate(value.template);
  return slug && template ? { projectId, slug, template } : null;
}
