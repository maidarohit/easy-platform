import type { WebsiteAiOutput } from "@/app/lib/ai/types";
import { isUsableBusinessUploadedSrc } from "@/app/lib/business-site-visuals";

export const WEBSITE_SITE_DOCUMENT_VERSION = 2 as const;

export const WEBSITE_PAGE_TYPES = [
  "home", "about", "services", "service", "portfolio", "project", "process", "faq", "contact", "custom",
] as const;
export type WebsitePageType = (typeof WEBSITE_PAGE_TYPES)[number];

export const WEBSITE_BLOCK_TYPES = [
  "hero", "content", "services", "serviceDetail", "gallery", "process", "faq", "contact", "cta",
] as const;
export type WebsiteBlockType = (typeof WEBSITE_BLOCK_TYPES)[number];
export type WebsiteVisibility = "visible" | "hidden";
export type WebsitePageVisibility = WebsiteVisibility | "removed";

export type WebsiteSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
};

type BlockBase<T extends WebsiteBlockType> = { id: string; type: T; order: number; visibility: WebsiteVisibility };
export type WebsiteBlock =
  | (BlockBase<"hero"> & { headline: string; description: string; ctaLabel: string; ctaHref: string })
  | (BlockBase<"content"> & { heading: string; body: string })
  | (BlockBase<"services"> & { heading: string; introduction: string; serviceIds: string[] })
  | (BlockBase<"serviceDetail"> & { serviceId: string; heading: string; body: string })
  | (BlockBase<"gallery"> & { heading: string; mediaIds: string[] })
  | (BlockBase<"process"> & { heading: string; steps: Array<{ id: string; title: string; body: string }> })
  | (BlockBase<"faq"> & { heading: string; items: Array<{ id: string; question: string; answer: string }> })
  | (BlockBase<"contact"> & { heading: string; body: string })
  | (BlockBase<"cta"> & { heading: string; body: string; label: string; href: string });

export type WebsitePage = {
  id: string;
  type: WebsitePageType;
  path: string;
  title: string;
  order: number;
  visibility: WebsitePageVisibility;
  seo: WebsiteSeo;
  blocks: WebsiteBlock[];
};

export type WebsiteSiteDocument = {
  schemaVersion: typeof WEBSITE_SITE_DOCUMENT_VERSION;
  theme: { template: string; colorPalette: string; typography: string };
  branding: { name: string; voice: string };
  navigation: { items: Array<{ id: string; pageId: string; label: string; order: number; visibility: WebsiteVisibility }> };
  header: { brandLabel: string; ctaLabel: string; ctaHref: string };
  footer: { businessName: string; description: string; showContact: boolean };
  pages: WebsitePage[];
};

export const RESERVED_WEBSITE_PAGE_SEGMENTS = new Set([
  "admin", "api", "assets", "dashboard", "login", "logout", "published-sites", "robots", "sitemap", "_next",
]);

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PATH_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;
const UNSAFE_TEXT = /<\/?[a-z][^>]*>|(?:javascript|vbscript)\s*:/i;
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/|#)[^\s]*$/i;
const MAX_TEXT = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function exact(value: Record<string, unknown>, fields: readonly string[]) {
  return Object.keys(value).every((key) => fields.includes(key)) && fields.every((key) => key in value);
}

function text(value: unknown, maximum = MAX_TEXT, required = false): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return ((!required || result) && result.length <= maximum && !UNSAFE_TEXT.test(result)) ? result : null;
}

function id(value: unknown) {
  return typeof value === "string" && value.length <= 100 && ID_PATTERN.test(value) ? value : null;
}

function visibility(value: unknown): WebsiteVisibility | null {
  return value === "visible" || value === "hidden" ? value : null;
}

function pageVisibility(value: unknown): WebsitePageVisibility | null {
  return value === "visible" || value === "hidden" || value === "removed" ? value : null;
}

function order(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000 ? value as number : null;
}

function stableReference(prefix: string, value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function legacyReferenceId(value: unknown, prefix: string) {
  const current = id(value);
  if (current) return current;
  const fallback = text(value, 200, true);
  return fallback ? stableReference(prefix, fallback.toLowerCase()) : null;
}

function normalizeReferenceList(
  value: unknown,
  prefix: string,
  input: { allowUploadedMedia?: boolean } = {},
) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items = value.map((item) => {
    if (input.allowUploadedMedia && typeof item === "string" && isUsableBusinessUploadedSrc(item)) {
      return stableReference("media", item.trim());
    }
    return legacyReferenceId(item, prefix);
  });
  return items.some((item) => !item) || new Set(items).size !== items.length ? null : items as string[];
}

export function validateWebsitePagePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160 || !PATH_PATTERN.test(value) || value.includes("//")) return null;
  if (value === "/") return value;
  const firstSegment = value.slice(1).split("/")[0];
  return RESERVED_WEBSITE_PAGE_SEGMENTS.has(firstSegment) ? null : value;
}

function validateSeo(value: unknown, pagePath: string): WebsiteSeo | null {
  if (!isRecord(value) || !exact(value, ["title", "description", "canonicalPath", "index"])) return null;
  const title = text(value.title, 70);
  const description = text(value.description, 165);
  const canonicalPath = validateWebsitePagePath(value.canonicalPath);
  if (title === null || description === null || canonicalPath !== pagePath || typeof value.index !== "boolean") return null;
  return { title, description, canonicalPath, index: value.index };
}

function validateIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const values = value.map(id);
  return values.some((item) => !item) || new Set(values).size !== values.length ? null : values as string[];
}

function validateBlock(value: unknown): WebsiteBlock | null {
  if (!isRecord(value) || !id(value.id) || !WEBSITE_BLOCK_TYPES.includes(value.type as WebsiteBlockType) || order(value.order) === null || !visibility(value.visibility)) return null;
  const base = { id: value.id as string, type: value.type as WebsiteBlockType, order: value.order as number, visibility: value.visibility as WebsiteVisibility };
  const strings = (fields: string[]) => fields.map((field) => text(value[field]));
  if (value.type === "hero" && exact(value, ["id", "type", "order", "visibility", "headline", "description", "ctaLabel", "ctaHref"])) {
    const [headline, description, ctaLabel, ctaHref] = strings(["headline", "description", "ctaLabel", "ctaHref"]);
    return headline !== null && description !== null && ctaLabel !== null && ctaHref !== null && SAFE_HREF.test(ctaHref) ? { ...base, type: "hero", headline, description, ctaLabel, ctaHref } : null;
  }
  if (value.type === "content" && exact(value, ["id", "type", "order", "visibility", "heading", "body"])) {
    const [heading, body] = strings(["heading", "body"]); return heading !== null && body !== null ? { ...base, type: "content", heading, body } : null;
  }
  if (value.type === "services" && exact(value, ["id", "type", "order", "visibility", "heading", "introduction", "serviceIds"])) {
    const [heading, introduction] = strings(["heading", "introduction"]), serviceIds = validateIdList(value.serviceIds);
    return heading !== null && introduction !== null && serviceIds ? { ...base, type: "services", heading, introduction, serviceIds } : null;
  }
  if (value.type === "serviceDetail" && exact(value, ["id", "type", "order", "visibility", "serviceId", "heading", "body"])) {
    const serviceId = id(value.serviceId), [heading, body] = strings(["heading", "body"]);
    return serviceId && heading !== null && body !== null ? { ...base, type: "serviceDetail", serviceId, heading, body } : null;
  }
  if (value.type === "gallery" && exact(value, ["id", "type", "order", "visibility", "heading", "mediaIds"])) {
    const heading = text(value.heading), mediaIds = validateIdList(value.mediaIds); return heading !== null && mediaIds ? { ...base, type: "gallery", heading, mediaIds } : null;
  }
  if ((value.type === "process" || value.type === "faq") && exact(value, ["id", "type", "order", "visibility", "heading", value.type === "process" ? "steps" : "items"])) {
    const heading = text(value.heading), list = value[value.type === "process" ? "steps" : "items"];
    if (heading === null || !Array.isArray(list) || list.length > 50) return null;
    if (value.type === "process") {
      const steps = list.map((item) => isRecord(item) && exact(item, ["id", "title", "body"]) && id(item.id) && text(item.title) !== null && text(item.body) !== null ? { id: item.id as string, title: text(item.title)!, body: text(item.body)! } : null);
      return steps.some((item) => !item) || new Set(steps.map((item) => item!.id)).size !== steps.length ? null : { ...base, type: "process", heading, steps: steps as Array<{ id: string; title: string; body: string }> };
    }
    const items = list.map((item) => isRecord(item) && exact(item, ["id", "question", "answer"]) && id(item.id) && text(item.question) !== null && text(item.answer) !== null ? { id: item.id as string, question: text(item.question)!, answer: text(item.answer)! } : null);
    return items.some((item) => !item) || new Set(items.map((item) => item!.id)).size !== items.length ? null : { ...base, type: "faq", heading, items: items as Array<{ id: string; question: string; answer: string }> };
  }
  if (value.type === "contact" && exact(value, ["id", "type", "order", "visibility", "heading", "body"])) {
    const [heading, body] = strings(["heading", "body"]); return heading !== null && body !== null ? { ...base, type: "contact", heading, body } : null;
  }
  if (value.type === "cta" && exact(value, ["id", "type", "order", "visibility", "heading", "body", "label", "href"])) {
    const [heading, body, label, href] = strings(["heading", "body", "label", "href"]);
    return heading !== null && body !== null && label !== null && href !== null && SAFE_HREF.test(href) ? { ...base, type: "cta", heading, body, label, href } : null;
  }
  return null;
}

function validateCanonicalWebsiteSiteDocument(value: unknown): WebsiteSiteDocument | null {
  if (!isRecord(value) || !exact(value, ["schemaVersion", "theme", "branding", "navigation", "header", "footer", "pages"]) || value.schemaVersion !== WEBSITE_SITE_DOCUMENT_VERSION) return null;
  const theme = value.theme, branding = value.branding, navigation = value.navigation, header = value.header, footer = value.footer;
  if (!isRecord(theme) || !exact(theme, ["template", "colorPalette", "typography"]) || !isRecord(branding) || !exact(branding, ["name", "voice"]) ||
      !isRecord(navigation) || !exact(navigation, ["items"]) || !isRecord(header) || !exact(header, ["brandLabel", "ctaLabel", "ctaHref"]) ||
      !isRecord(footer) || !exact(footer, ["businessName", "description", "showContact"]) || !Array.isArray(value.pages) || !Array.isArray(navigation.items)) return null;
  const themeValues = [text(theme.template, 100, true), text(theme.colorPalette), text(theme.typography)];
  const brandValues = [text(branding.name, 200, true), text(branding.voice)];
  const headerValues = [text(header.brandLabel, 200, true), text(header.ctaLabel, 200), text(header.ctaHref, 500)];
  const footerValues = [text(footer.businessName, 200, true), text(footer.description)];
  if ([...themeValues, ...brandValues, ...headerValues, ...footerValues].some((item) => item === null) || !SAFE_HREF.test(headerValues[2]!) || typeof footer.showContact !== "boolean" || value.pages.length < 1 || value.pages.length > 100) return null;
  const pages = value.pages.map((raw): WebsitePage | null => {
    if (!isRecord(raw) || !exact(raw, ["id", "type", "path", "title", "order", "visibility", "seo", "blocks"]) || !id(raw.id) || !WEBSITE_PAGE_TYPES.includes(raw.type as WebsitePageType) || !Array.isArray(raw.blocks)) return null;
    const path = validateWebsitePagePath(raw.path), pageOrder = order(raw.order), validPageVisibility = pageVisibility(raw.visibility);
    if (!path || pageOrder === null || !validPageVisibility || text(raw.title, 200, true) === null || raw.blocks.length > 100) return null;
    const seo = validateSeo(raw.seo, path), blocks = raw.blocks.map(validateBlock);
    if (!seo || blocks.some((block) => !block) || new Set(blocks.map((block) => block!.id)).size !== blocks.length) return null;
    return { id: raw.id as string, type: raw.type as WebsitePageType, path, title: text(raw.title, 200, true)!, order: pageOrder, visibility: validPageVisibility, seo, blocks: blocks as WebsiteBlock[] };
  });
  if (pages.some((page) => !page)) return null;
  const validPages = pages as WebsitePage[], pageIds = new Set(validPages.map((page) => page.id));
  if (pageIds.size !== validPages.length || new Set(validPages.map((page) => page.path)).size !== validPages.length ||
      validPages.filter((page) => page.type === "home" && page.path === "/" && page.visibility !== "removed").length !== 1 || validPages.some((page) => page.path === "/" && page.type !== "home")) return null;
  const items = navigation.items.map((raw) => {
    if (!isRecord(raw) || !exact(raw, ["id", "pageId", "label", "order", "visibility"]) || !id(raw.id) || !id(raw.pageId) || !pageIds.has(raw.pageId as string) || text(raw.label, 200, true) === null || order(raw.order) === null || !visibility(raw.visibility)) return null;
    return { id: raw.id as string, pageId: raw.pageId as string, label: text(raw.label, 200, true)!, order: raw.order as number, visibility: raw.visibility as WebsiteVisibility };
  });
  if (items.some((item) => !item) || new Set(items.map((item) => item!.id)).size !== items.length || new Set(items.map((item) => item!.pageId)).size !== items.length) return null;
  return {
    schemaVersion: WEBSITE_SITE_DOCUMENT_VERSION,
    theme: { template: themeValues[0]!, colorPalette: themeValues[1]!, typography: themeValues[2]! },
    branding: { name: brandValues[0]!, voice: brandValues[1]! }, navigation: { items: items as WebsiteSiteDocument["navigation"]["items"] },
    header: { brandLabel: headerValues[0]!, ctaLabel: headerValues[1]!, ctaHref: headerValues[2]! },
    footer: { businessName: footerValues[0]!, description: footerValues[1]!, showContact: footer.showContact }, pages: validPages,
  };
}

function normalizeLegacyPageType(value: unknown, path: string): WebsitePageType | null {
  if (path === "/") return "home";
  return WEBSITE_PAGE_TYPES.includes(value as WebsitePageType) && value !== "home"
    ? value as WebsitePageType
    : null;
}

function normalizeLegacySeo(value: unknown, path: string, title: string, pageVisibilityValue: WebsitePageVisibility): WebsiteSeo {
  const current = validateSeo(value, path);
  if (current) return current;
  return {
    title: title.slice(0, 70),
    description: "",
    canonicalPath: path,
    index: pageVisibilityValue !== "removed",
  };
}

function normalizeLegacyProcessSteps(value: unknown): Array<{ id: string; title: string; body: string }> | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const entries = value.map((item, index) => {
    if (!isRecord(item)) return null;
    const itemId = legacyReferenceId(item.id, "step");
    if (!itemId) return null;
    const title = text(item.title), body = text(item.body);
    return title !== null && body !== null ? { id: itemId, title, body } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (entries.length !== value.length) return null;
  const unique = entries.map((item, index) => item.id === entries.find((candidate, candidateIndex) => candidateIndex !== index && candidate.id === item.id)?.id
    ? { ...item, id: stableReference("step", `${item.id}:${index}`) }
    : item);
  return new Set(unique.map((item) => item.id)).size === unique.length ? unique : null;
}

function normalizeLegacyFaqItems(value: unknown): Array<{ id: string; question: string; answer: string }> | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const entries = value.map((item, index) => {
    if (!isRecord(item)) return null;
    const itemId = legacyReferenceId(item.id, "faq");
    if (!itemId) return null;
    const question = text(item.question), answer = text(item.answer);
    return question !== null && answer !== null ? { id: itemId, question, answer } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (entries.length !== value.length) return null;
  const unique = entries.map((item, index) => item.id === entries.find((candidate, candidateIndex) => candidateIndex !== index && candidate.id === item.id)?.id
    ? { ...item, id: stableReference("faq", `${item.id}:${index}`) }
    : item);
  return new Set(unique.map((item) => item.id)).size === unique.length ? unique : null;
}

function normalizeLegacyBlock(value: unknown, index: number): WebsiteBlock | null {
  if (!isRecord(value) || !WEBSITE_BLOCK_TYPES.includes(value.type as WebsiteBlockType)) return null;
  const blockId = legacyReferenceId(value.id, "block");
  const blockOrder = order(value.order) ?? index;
  const blockVisibility = visibility(value.visibility) ?? "visible";
  if (!blockId) return null;
  const base = { id: blockId, type: value.type as WebsiteBlockType, order: blockOrder, visibility: blockVisibility };
  if (value.type === "hero") {
    const headline = text(value.headline), description = text(value.description), ctaLabel = text(value.ctaLabel), ctaHref = text(value.ctaHref, 500);
    return headline !== null && description !== null && ctaLabel !== null && ctaHref !== null && SAFE_HREF.test(ctaHref)
      ? { ...base, type: "hero", headline, description, ctaLabel, ctaHref }
      : null;
  }
  if (value.type === "content") {
    const heading = text(value.heading), body = text(value.body);
    return heading !== null && body !== null ? { ...base, type: "content", heading, body } : null;
  }
  if (value.type === "services") {
    const heading = text(value.heading), introduction = text(value.introduction), serviceIds = normalizeReferenceList(value.serviceIds, "service");
    return heading !== null && introduction !== null && serviceIds ? { ...base, type: "services", heading, introduction, serviceIds } : null;
  }
  if (value.type === "serviceDetail") {
    const serviceId = legacyReferenceId(value.serviceId, "service"), heading = text(value.heading), body = text(value.body);
    return serviceId && heading !== null && body !== null ? { ...base, type: "serviceDetail", serviceId, heading, body } : null;
  }
  if (value.type === "gallery") {
    const heading = text(value.heading), mediaIds = normalizeReferenceList(value.mediaIds, "media", { allowUploadedMedia: true });
    return heading !== null && mediaIds ? { ...base, type: "gallery", heading, mediaIds } : null;
  }
  if (value.type === "process") {
    const heading = text(value.heading), steps = normalizeLegacyProcessSteps(value.steps);
    return heading !== null && steps ? { ...base, type: "process", heading, steps } : null;
  }
  if (value.type === "faq") {
    const heading = text(value.heading), items = normalizeLegacyFaqItems(value.items);
    return heading !== null && items ? { ...base, type: "faq", heading, items } : null;
  }
  if (value.type === "contact") {
    const heading = text(value.heading), body = text(value.body);
    return heading !== null && body !== null ? { ...base, type: "contact", heading, body } : null;
  }
  const heading = text(value.heading), body = text(value.body), label = text(value.label), href = text(value.href, 500);
  return heading !== null && body !== null && label !== null && href !== null && SAFE_HREF.test(href)
    ? { ...base, type: "cta", heading, body, label, href }
    : null;
}

function normalizeLegacyWebsiteSiteDocument(value: unknown): WebsiteSiteDocument | null {
  if (!isRecord(value) || ![WEBSITE_SITE_DOCUMENT_VERSION, String(WEBSITE_SITE_DOCUMENT_VERSION)].includes(value.schemaVersion as never)) return null;
  const theme = isRecord(value.theme) ? value.theme : null;
  const branding = isRecord(value.branding) ? value.branding : null;
  const navigation = isRecord(value.navigation) ? value.navigation : null;
  const header = isRecord(value.header) ? value.header : null;
  const footer = isRecord(value.footer) ? value.footer : null;
  if (!theme || !branding || !navigation || !header || !footer || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100) return null;

  const normalizedPages = value.pages.map((raw, index): WebsitePage | null => {
    if (!isRecord(raw) || !Array.isArray(raw.blocks) || raw.blocks.length > 100) return null;
    const path = validateWebsitePagePath(raw.path);
    const title = text(raw.title, 200, true);
    if (!path || !title) return null;
    const pageId = legacyReferenceId(raw.id, "page");
    const pageType = normalizeLegacyPageType(raw.type, path);
    const pageOrder = order(raw.order) ?? index;
    const pageVisibilityValue = pageVisibility(raw.visibility) ?? "visible";
    const blocks = raw.blocks.map((block, blockIndex) => normalizeLegacyBlock(block, blockIndex));
    if (!pageId || !pageType || blocks.some((block) => !block)) return null;
    const uniqueBlocks = (blocks as WebsiteBlock[]).map((block, blockIndex, list) =>
      list.findIndex((candidate) => candidate.id === block.id) === blockIndex
        ? block
        : { ...block, id: stableReference("block", `${pageId}:${block.id}:${blockIndex}`) });
    if (new Set(uniqueBlocks.map((block) => block.id)).size !== uniqueBlocks.length) return null;
    return {
      id: pageId,
      type: pageType,
      path,
      title,
      order: pageOrder,
      visibility: pageVisibilityValue,
      seo: normalizeLegacySeo(raw.seo, path, title, pageVisibilityValue),
      blocks: uniqueBlocks,
    };
  });
  if (normalizedPages.some((page) => !page)) return null;
  const pages = normalizedPages as WebsitePage[];
  if (new Set(pages.map((page) => page.id)).size !== pages.length || new Set(pages.map((page) => page.path)).size !== pages.length) return null;

  const pageIds = new Set(pages.map((page) => page.id));
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const normalizedItems = Array.isArray(navigation.items) ? navigation.items.map((raw, index) => {
    if (!isRecord(raw)) return null;
    const rawPageId = legacyReferenceId(raw.pageId, "page");
    const page = rawPageId ? pageById.get(rawPageId) : null;
    if (!page) return null;
    return {
      id: legacyReferenceId(raw.id, "nav") ?? stableReference("nav", `${page.id}:${index}`),
      pageId: page.id,
      label: text(raw.label, 200, true) ?? page.title,
      order: order(raw.order) ?? page.order,
      visibility: visibility(raw.visibility) ?? (page.visibility === "visible" ? "visible" : "hidden"),
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)) : [];
  const seenPageIds = new Set(normalizedItems.map((item) => item.pageId));
  const generatedItems = pages
    .filter((page) => page.visibility !== "removed" && !seenPageIds.has(page.id))
    .map((page, index) => ({
      id: stableReference("nav", `${page.id}:${normalizedItems.length + index}`),
      pageId: page.id,
      label: page.title,
      order: page.order,
      visibility: page.visibility === "visible" ? "visible" as const : "hidden" as const,
    }));
  const items = [...normalizedItems, ...generatedItems].map((item, index, list) =>
    list.findIndex((candidate) => candidate.id === item.id) === index
      ? item
      : { ...item, id: stableReference("nav", `${item.pageId}:${item.id}:${index}`) });
  if (items.some((item) => !pageIds.has(item.pageId)) || new Set(items.map((item) => item.id)).size !== items.length || new Set(items.map((item) => item.pageId)).size !== items.length) return null;

  const normalized = {
    schemaVersion: WEBSITE_SITE_DOCUMENT_VERSION,
    theme: {
      template: text(theme.template, 100, true) ?? "Modern",
      colorPalette: text(theme.colorPalette) ?? "",
      typography: text(theme.typography) ?? "",
    },
    branding: {
      name: text(branding.name, 200, true) ?? "",
      voice: text(branding.voice) ?? "",
    },
    navigation: { items },
    header: {
      brandLabel: text(header.brandLabel, 200, true) ?? (text(branding.name, 200, true) ?? ""),
      ctaLabel: text(header.ctaLabel, 200) ?? "",
      ctaHref: (() => {
        const candidate = text(header.ctaHref, 500) ?? "#contact";
        return SAFE_HREF.test(candidate) ? candidate : "#contact";
      })(),
    },
    footer: {
      businessName: text(footer.businessName, 200, true) ?? (text(branding.name, 200, true) ?? ""),
      description: text(footer.description) ?? "",
      showContact: typeof footer.showContact === "boolean" ? footer.showContact : true,
    },
    pages,
  };
  return validateCanonicalWebsiteSiteDocument(normalized);
}

export function validateWebsiteSiteDocument(value: unknown): WebsiteSiteDocument | null {
  return validateCanonicalWebsiteSiteDocument(value) ?? normalizeLegacyWebsiteSiteDocument(value);
}

export function removeWebsitePage(document: WebsiteSiteDocument, pageId: string): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document), target = current?.pages.find((page) => page.id === pageId);
  if (!current || !target || target.type === "home" || target.path === "/") return null;
  return validateWebsiteSiteDocument({ ...current, pages: current.pages.map((page) => page.id === pageId ? { ...page, visibility: "removed" } : page) });
}

function pageIdFromTitle(document: WebsiteSiteDocument, title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";
  let candidate = `page-${base}`.slice(0, 100).replace(/-$/, "");
  let suffix = 2;
  while (document.pages.some((page) => page.id === candidate)) candidate = `page-${base}-${suffix++}`.slice(0, 100).replace(/-$/, "");
  return candidate;
}

export function addWebsitePage(document: WebsiteSiteDocument, input: { title: string; path: string; type: Exclude<WebsitePageType, "home"> }): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document), path = validateWebsitePagePath(input.path), title = text(input.title, 200, true);
  if (!current || !path || path === "/" || !title || !WEBSITE_PAGE_TYPES.includes(input.type) || current.pages.some((page) => page.path === path)) return null;
  const pageId = pageIdFromTitle(current, title);
  const page: WebsitePage = { id: pageId, type: input.type, path, title, order: current.pages.length, visibility: "visible", seo: { title: title.slice(0, 70), description: "", canonicalPath: path, index: true }, blocks: [] };
  return validateWebsiteSiteDocument({ ...current, pages: [...current.pages, page], navigation: { items: [...current.navigation.items, { id: `nav-${pageId.slice(5)}`, pageId, label: title, order: current.navigation.items.length, visibility: "visible" }] } });
}

export function renameWebsitePage(document: WebsiteSiteDocument, pageId: string, input: { title: string; path: string }): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document), title = text(input.title, 200, true), path = validateWebsitePagePath(input.path);
  const target = current?.pages.find((page) => page.id === pageId);
  if (!current || !target || !title || !path || (target.type === "home" && path !== "/") || current.pages.some((page) => page.id !== pageId && page.path === path)) return null;
  return validateWebsiteSiteDocument({ ...current,
    pages: current.pages.map((page) => page.id === pageId ? { ...page, title, path, seo: { ...page.seo, title: page.seo.title === page.title.slice(0, 70) ? title.slice(0, 70) : page.seo.title, canonicalPath: path } } : page),
    navigation: { items: current.navigation.items.map((item) => item.pageId === pageId ? { ...item, label: item.label === target.title ? title : item.label } : item) },
  });
}

export function reorderWebsitePages(document: WebsiteSiteDocument, orderedPageIds: string[]): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document);
  if (!current || orderedPageIds.length !== current.pages.length || new Set(orderedPageIds).size !== current.pages.length || orderedPageIds.some((pageId) => !current.pages.some((page) => page.id === pageId))) return null;
  const orders = new Map(orderedPageIds.map((pageId, index) => [pageId, index]));
  return validateWebsiteSiteDocument({ ...current,
    pages: current.pages.map((page) => ({ ...page, order: orders.get(page.id)! })),
    navigation: { items: current.navigation.items.map((item) => ({ ...item, order: orders.get(item.pageId)! })) },
  });
}

export function setWebsitePageNavigationVisibility(document: WebsiteSiteDocument, pageId: string, visible: boolean): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document), target = current?.pages.find((page) => page.id === pageId);
  if (!current || !target || target.visibility === "removed") return null;
  return validateWebsiteSiteDocument({ ...current, navigation: { items: current.navigation.items.map((item) => item.pageId === pageId ? { ...item, visibility: visible ? "visible" : "hidden" } : item) } });
}

export function restoreWebsitePage(document: WebsiteSiteDocument, pageId: string): WebsiteSiteDocument | null {
  const current = validateWebsiteSiteDocument(document), target = current?.pages.find((page) => page.id === pageId);
  if (!current || !target || target.visibility !== "removed") return null;
  return validateWebsiteSiteDocument({ ...current, pages: current.pages.map((page) => page.id === pageId ? { ...page, visibility: "visible" } : page), navigation: { items: current.navigation.items.map((item) => item.pageId === pageId ? { ...item, visibility: "hidden" } : item) } });
}

export function adaptLegacyWebsiteToSiteDocument(input: {
  companyName: string; template: string; websiteOutput: WebsiteAiOutput; websiteEdits?: WebsiteAiOutput["websiteEdits"];
}): WebsiteSiteDocument {
  const edits = input.websiteEdits ?? input.websiteOutput.websiteEdits;
  const name = edits?.companyName?.trim() || input.companyName.trim();
  const headline = edits?.heroHeadline?.trim() || name;
  const description = edits?.heroDescription?.trim() || input.websiteOutput.websiteOverview.trim();
  const ctaLabel = edits?.primaryCtaLabel?.trim() || "Contact";
  const ctaHref = edits?.primaryCtaLink?.trim() || "#contact";
  return {
    schemaVersion: WEBSITE_SITE_DOCUMENT_VERSION,
    theme: { template: edits?.template || input.template, colorPalette: input.websiteOutput.colourScheme.trim(), typography: input.websiteOutput.typography.trim() },
    branding: { name, voice: "" },
    navigation: { items: [{ id: "nav-home", pageId: "page-home", label: "Home", order: 0, visibility: "visible" }] },
    header: { brandLabel: name, ctaLabel, ctaHref }, footer: { businessName: name, description, showContact: true },
    pages: [{ id: "page-home", type: "home", path: "/", title: "Home", order: 0, visibility: "visible", seo: { title: name.slice(0, 70), description: description.slice(0, 165), canonicalPath: "/", index: true }, blocks: [
      { id: "block-home-hero", type: "hero", order: 0, visibility: "visible", headline, description, ctaLabel, ctaHref },
      { id: "block-home-content", type: "content", order: 1, visibility: "visible", heading: "About", body: edits?.aboutText?.trim() || input.websiteOutput.websiteOverview.trim() },
      { id: "block-home-services", type: "services", order: 2, visibility: "visible", heading: "Services", introduction: edits?.servicesText?.trim() || input.websiteOutput.websiteFeatures.trim(), serviceIds: [] },
      { id: "block-home-contact", type: "contact", order: 3, visibility: "visible", heading: "Contact", body: "" },
    ] }],
  };
}

export function buildWebsiteSiteDocumentWithTheme(input: {
  siteDocument?: WebsiteSiteDocument | null;
  companyName: string;
  template: string;
  colorPalette: string;
  typography: string;
  websiteOutput: WebsiteAiOutput;
  websiteEdits?: WebsiteAiOutput["websiteEdits"];
}): WebsiteSiteDocument | null {
  const baseDocument = validateWebsiteSiteDocument(input.siteDocument) ?? adaptLegacyWebsiteToSiteDocument({
    companyName: input.companyName,
    template: input.template,
    websiteOutput: input.websiteOutput,
    websiteEdits: input.websiteEdits,
  });
  return validateWebsiteSiteDocument({
    ...baseDocument,
    theme: {
      template: input.template,
      colorPalette: input.colorPalette,
      typography: input.typography,
    },
  });
}
