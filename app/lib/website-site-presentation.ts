import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { validateWebsiteSiteDocument, type WebsitePage, type WebsiteSiteDocument } from "@/app/lib/website-site-document";

const INTERNAL_PUBLIC_TEXT = /(?:^(?:primary|objective|strategy|goal|recommendation|proposed recommendation|kpi|priority|funnel)\s*:|\b(?:describe|mention|claim|include|add)\b[^.!?\n]{0,160}\bonly when\b|\b(?:internal strategy|implementation notes?|planning notes?|system instruction|prompt)\b)/i;
const HTML_OR_SCRIPT = /<\/?[a-z][^>]*>|(?:javascript|vbscript)\s*:/i;

export function safeWebsiteBlockText(value: string, maximum = 4_000) {
  const candidate = value.replace(/\s+/g, " ").trim();
  return candidate && candidate.length <= maximum && !HTML_OR_SCRIPT.test(candidate) &&
    !INTERNAL_PUBLIC_TEXT.test(candidate) && !hasUnsupportedPublicClaim(candidate) ? candidate : "";
}

export function resolveWebsiteSitePage(document: WebsiteSiteDocument, path: string): WebsitePage | null {
  const validated = validateWebsiteSiteDocument(document);
  if (!validated) return null;
  const normalized = path === "" ? "/" : path.replace(/\/$/, "") || "/";
  return validated.pages.find((page) => page.path === normalized && page.visibility === "visible") ?? null;
}

export function visibleWebsiteNavigation(document: WebsiteSiteDocument) {
  const validated = validateWebsiteSiteDocument(document);
  if (!validated) return [];
  const pages = new Map(validated.pages.map((page) => [page.id, page]));
  return validated.navigation.items
    .filter((item) => item.visibility === "visible" && pages.get(item.pageId)?.visibility === "visible" && Boolean(safeWebsiteBlockText(item.label, 100)))
    .sort((a, b) => a.order - b.order);
}
