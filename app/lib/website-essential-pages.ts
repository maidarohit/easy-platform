import { hasUnsupportedPublicClaim } from "@/app/lib/public-content-safety";
import { isUsableBusinessUploadedSrc } from "@/app/lib/business-site-visuals";
import {
  addWebsitePage,
  setWebsitePageNavigationVisibility,
  validateWebsiteSiteDocument,
  type WebsiteBlock,
  type WebsitePageType,
  type WebsiteSiteDocument,
} from "@/app/lib/website-site-document";

export type VerifiedWebsiteService = Readonly<{
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}>;

export type EssentialWebsitePageData = Readonly<{
  projectDescription?: string | null;
  services?: readonly VerifiedWebsiteService[];
  projectMedia?: readonly string[];
}>;

const INTERNAL_OR_INSTRUCTION = /(?:^(?:primary|objective|strategy|goal|recommendation|proposed recommendation|kpi|priority|funnel)\s*:|\b(?:describe|mention|claim|include|add|write)\b[^.!?\n]{0,160}\b(?:only when|if verified|when verified)\b|\b(?:marketing strategy|sales strategy|campaign timeline|content calendar|lead scoring|implementation notes?|target customer profile|outreach plan)\b|\b(?:we (?:started|began|were founded)|founded (?:in|by)|small team of|years? of experience|founders?|team composition)\b|<\/?[a-z][^>]*>|(?:javascript|vbscript)\s*:)/i;

function verifiedText(value: string | null | undefined, maximum = 4_000) {
  const candidate = value?.replace(/\s+/g, " ").trim();
  return candidate && candidate.length <= maximum && !INTERNAL_OR_INSTRUCTION.test(candidate) && !hasUnsupportedPublicClaim(candidate) ? candidate : "";
}

function slugPart(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
}

function stableReference(prefix: string, value: string) {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function websiteMediaReference(value: string) {
  return stableReference("media", value);
}

function serviceReference(service: VerifiedWebsiteService) {
  return stableReference("service", service.id);
}

function replaceNewPageBlocks(document: WebsiteSiteDocument, path: string, blocks: WebsiteBlock[]) {
  return validateWebsiteSiteDocument({ ...document, pages: document.pages.map((page) => page.path === path ? { ...page, blocks } : page) });
}

function addPage(document: WebsiteSiteDocument, title: string, path: string, type: Exclude<WebsitePageType, "home">, blocks: WebsiteBlock[], showInNavigation = true) {
  if (document.pages.some((page) => page.path === path)) return document;
  const added = addWebsitePage(document, { title, path, type });
  if (!added) return null;
  const withBlocks = replaceNewPageBlocks(added, path, blocks);
  if (!withBlocks || showInNavigation) return withBlocks;
  const page = withBlocks.pages.find((item) => item.path === path);
  return page ? setWebsitePageNavigationVisibility(withBlocks, page.id, false) : null;
}

export function addEssentialWebsitePages(document: WebsiteSiteDocument, data: EssentialWebsitePageData): WebsiteSiteDocument | null {
  let current = validateWebsiteSiteDocument(document);
  if (!current) return null;
  const description = verifiedText(data.projectDescription, 1_500);
  const services = (data.services ?? []).map((service) => ({ ...service,
    name: verifiedText(service.name, 160), description: verifiedText(service.description, 1_500),
    imageUrl: isUsableBusinessUploadedSrc(service.imageUrl) ? service.imageUrl!.trim() : null,
  })).filter((service) => service.id && service.name);
  const projectMedia = [...new Set((data.projectMedia ?? []).filter((src) => isUsableBusinessUploadedSrc(src)).map((src) => src.trim()))];
  const serviceIds = services.map(serviceReference);
  const additions: Array<[string, string, Exclude<WebsitePageType, "home">, WebsiteBlock[], boolean?]> = [
    ["Services", "/services", "services", [{ id: "block-services", type: "services", order: 0, visibility: "visible", heading: "Services", introduction: description, serviceIds }]],
    ["Projects", "/projects", "portfolio", [{ id: "block-projects", type: "gallery", order: 0, visibility: "visible", heading: "Projects", mediaIds: projectMedia.map(websiteMediaReference) }]],
    ["Process", "/process", "process", [{ id: "block-process", type: "process", order: 0, visibility: "visible", heading: "Process", steps: [] }]],
    ["FAQ", "/faq", "faq", [{ id: "block-faq", type: "faq", order: 0, visibility: "visible", heading: "Frequently asked questions", items: [] }]],
    ["Contact", "/contact", "contact", [{ id: "block-contact", type: "contact", order: 0, visibility: "visible", heading: "Contact", body: "" }]],
  ];
  for (const addition of additions) {
    const next = addPage(current, ...addition);
    if (!next) return null;
    current = next;
  }
  const usedServicePaths = new Set<string>();
  for (const service of services) {
    let segment = slugPart(service.slug || service.name) || serviceReference(service).slice(8);
    let path = `/services/${segment}`;
    if (usedServicePaths.has(path) || (current.pages.some((page) => page.path === path) && !current.pages.some((page) => page.path === path && page.type === "service"))) {
      segment = `${segment}-${serviceReference(service).slice(-6)}`;
      path = `/services/${segment}`;
    }
    usedServicePaths.add(path);
    const blocks: WebsiteBlock[] = [{ id: `block-${serviceReference(service)}`, type: "serviceDetail", order: 0, visibility: "visible", serviceId: serviceReference(service), heading: service.name, body: service.description }];
    if (service.imageUrl) blocks.push({ id: `block-${serviceReference(service)}-media`, type: "gallery", order: 1, visibility: "visible", heading: service.name, mediaIds: [websiteMediaReference(service.imageUrl)] });
    const next = addPage(current, service.name, path, "service", blocks, false);
    if (!next) return null;
    current = next;
  }
  for (const [index, media] of projectMedia.entries()) {
    const reference = websiteMediaReference(media), path = `/projects/${reference.slice(6)}`;
    const next = addPage(current, `Project ${index + 1}`, path, "project", [{ id: `block-project-${reference.slice(6)}`, type: "gallery", order: 0, visibility: "visible", heading: "Project", mediaIds: [reference] }], false);
    if (!next) return null;
    current = next;
  }
  return validateWebsiteSiteDocument(current);
}
