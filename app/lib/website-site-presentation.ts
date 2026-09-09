import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { validateWebsiteSiteDocument, type WebsitePage, type WebsiteSiteDocument } from "@/app/lib/website-site-document";

const INTERNAL_PUBLIC_TEXT = /(?:^(?:primary|objective|strategy|goal|recommendation|proposed recommendation|kpi|priority|funnel)\s*:|\b(?:describe|mention|claim|include|add)\b[^.!?\n]{0,160}\bonly when\b|\b(?:internal strategy|implementation notes?|planning notes?|system instruction|prompt|project brief|original brief|customer brief)\b|\bwe started as\b)/i;
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

export function publicWebsitePageBlocks(document: WebsiteSiteDocument, path: string) {
  const validated = validateWebsiteSiteDocument(document), page = validated && resolvePublishedWebsitePage(validated, path);
  return page?.blocks ?? [];
}

export function publicWebsitePageSeo(document: WebsiteSiteDocument, path: string) {
  const validated = validateWebsiteSiteDocument(document), page = validated && resolvePublishedWebsitePage(validated, path);
  if (!validated || !page) return null;
  const brand = safeWebsiteBlockText(validated.branding.name, 70) || "Business";
  const title = safeWebsiteBlockText(page.seo.title, 70) || safeWebsiteBlockText(page.title, 70) || brand;
  const description = safeWebsiteBlockText(page.seo.description, 165) || undefined;
  return { title, description, canonicalPath: page.path, index: page.seo.index };
}
