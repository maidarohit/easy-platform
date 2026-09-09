import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { validateWebsiteSiteDocument, type WebsiteBlock, type WebsitePage, type WebsiteSiteDocument } from "@/app/lib/website-site-document";

const INTERNAL_PUBLIC_TEXT = /(?:^(?:primary|objective|strategy|goal|recommendation|proposed recommendation|kpi|priority|funnel)\s*:|^(?:i run|i want|we want|our goal is|we need|i need)\b|\bthe website (?:will|should|must|needs? to)\b|\bthe tone (?:will|should|must)\b|\b(?:describe|mention|claim|include|add|write|showcase|highlight)\b[^.!?\n]{0,160}\b(?:only when|if verified|when verified|on the website)\b|\b(?:internal strategy|implementation notes?|planning notes?|system instruction|prompt|project brief|original brief|customer brief|target audience|conversion goal|website requirements?)\b|\b(?:we started as|we began as|founded by|our founders?|our team of)\b)/i;
const HTML_OR_SCRIPT = /<\/?[a-z][^>]*>|(?:javascript|vbscript)\s*:/i;

export function safeWebsiteBlockText(value: string, maximum = 4_000) {
  const candidate = value.replace(/\s+/g, " ").trim();
  return candidate && candidate.length <= maximum && !HTML_OR_SCRIPT.test(candidate) &&
    !INTERNAL_PUBLIC_TEXT.test(candidate) && !hasUnsupportedPublicClaim(candidate) ? candidate : "";
}

export function resolveWebsiteSitePage(document: WebsiteSiteDocument, path: string, includeHidden = false): WebsitePage | null {
  const validated = validateWebsiteSiteDocument(document);
  if (!validated) return null;
  const normalized = path === "" ? "/" : path.replace(/\/$/, "") || "/";
  return validated.pages.find((page) => page.path === normalized && (page.visibility === "visible" || (includeHidden && page.visibility === "hidden"))) ?? null;
}

export function visibleWebsiteNavigation(document: WebsiteSiteDocument) {
  const validated = validateWebsiteSiteDocument(document);
  if (!validated) return [];
  const pages = new Map(validated.pages.map((page) => [page.id, page]));
  return validated.navigation.items
    .filter((item) => item.visibility === "visible" && pages.get(item.pageId)?.visibility === "visible" && Boolean(safeWebsiteBlockText(item.label, 100)))
    .sort((a, b) => a.order - b.order);
}

function supportedPublicPage(page: WebsitePage) {
  if (page.path === "/") return page.type === "home";
  if (page.path === "/about") return page.type === "about";
  if (page.path === "/services") return page.type === "services";
  if (/^\/services\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.path)) return page.type === "service";
  if (page.path === "/projects") return page.type === "portfolio";
  if (/^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.path)) return page.type === "project";
  if (page.path === "/process") return page.type === "process";
  if (page.path === "/faq") return page.type === "faq";
  if (page.path === "/contact") return page.type === "contact";
  return false;
}

export function resolvePublishedWebsitePage(document: WebsiteSiteDocument, path: string) {
  const page = resolveWebsiteSitePage(document, path);
  return page && supportedPublicPage(page) ? page : null;
}

export function visiblePublishedWebsitePages(document: WebsiteSiteDocument) {
  const validated = validateWebsiteSiteDocument(document);
  return validated ? validated.pages.filter((page) => page.visibility === "visible" && supportedPublicPage(page)).sort((a, b) => a.order - b.order) : [];
}

export function publicWebsitePageBlocks(document: WebsiteSiteDocument, path: string, includeHidden = false) {
  const validated = validateWebsiteSiteDocument(document);
  const page = validated && (includeHidden ? resolveWebsiteSitePage(validated, path, true) : resolvePublishedWebsitePage(validated, path));
  if (!validated || !page) return [];
  if (page.path !== "/") return page.blocks;

  const hero = page.blocks.find((block): block is Extract<WebsiteBlock, { type: "hero" }> => block.type === "hero");
  const services = page.blocks.find((block): block is Extract<WebsiteBlock, { type: "services" }> => block.type === "services");
  const projects = validated.pages.find((item) => item.type === "portfolio" && item.visibility === "visible")?.blocks
    .find((block): block is Extract<WebsiteBlock, { type: "gallery" }> => block.type === "gallery" && block.visibility === "visible" && block.mediaIds.length > 0);
  const process = validated.pages.find((item) => item.type === "process" && item.visibility === "visible")?.blocks
    .find((block): block is Extract<WebsiteBlock, { type: "process" }> => block.type === "process" && block.visibility === "visible");
  const about = page.blocks.find((block): block is Extract<WebsiteBlock, { type: "content" }> => block.type === "content" && Boolean(safeWebsiteBlockText(block.body)));
  const ctaLabel = safeWebsiteBlockText(validated.header.ctaLabel, 100) || "Contact";
  const contactPath = validated.pages.find((item) => item.type === "contact" && item.visibility === "visible")?.path || "/contact";
  const homeHero: WebsiteBlock = hero ? {
    ...hero,
    headline: /^(?:contact|get in touch|enquire|book|request)(?:\s|$)/i.test(hero.headline.trim()) ? validated.branding.name : hero.headline,
    order: 0,
  } : { id: "block-home-hero-presentation", type: "hero", order: 0, visibility: "visible", headline: validated.branding.name, description: "", ctaLabel, ctaHref: contactPath };
  const finalCta: WebsiteBlock = { id: "block-home-final-cta", type: "cta", order: 5, visibility: "visible", heading: "Start a conversation", body: "Tell us what you are looking for and we can discuss the right next step.", label: ctaLabel, href: contactPath };
  return [
    homeHero,
    ...(services ? [{ ...services, order: 1 }] : []),
    ...(projects ? [{ ...projects, id: "block-home-projects-preview", order: 2 }] : []),
    ...(process ? [{ ...process, id: "block-home-process-preview", order: 3 }] : []),
    ...(about ? [{ ...about, order: 4 }] : []),
    finalCta,
  ] as WebsiteBlock[];
}

export function publicWebsitePageSeo(document: WebsiteSiteDocument, path: string) {
  const validated = validateWebsiteSiteDocument(document), page = validated && resolvePublishedWebsitePage(validated, path);
  if (!validated || !page) return null;
  const brand = safeWebsiteBlockText(validated.branding.name, 70) || "Business";
  const title = safeWebsiteBlockText(page.seo.title, 70) || safeWebsiteBlockText(page.title, 70) || brand;
  const description = safeWebsiteBlockText(page.seo.description, 165) || undefined;
  return { title, description, canonicalPath: page.path, index: page.seo.index };
}
