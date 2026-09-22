import type { WebsitePage } from "./website-site-document";
import type { ResolvedWebsiteMedia } from "./business-site-visuals";

export function authoredProspectBlocks(page: WebsitePage) {
  const blocks = page.blocks.filter(block => block.visibility === "visible").sort((a, b) => a.order - b.order);
  const ids = new Set(blocks.map(block => block.id));
  const safeHref = (href: string) => href.startsWith("#") && ids.has(href.slice(1)) ? href : "#hero";
  return blocks.map(block => block.type === "hero" ? { ...block, ctaHref: safeHref(block.ctaHref) }
    : block.type === "cta" ? { ...block, href: safeHref(block.href) } : block);
}

export function prospectPresentationMedia(media: ResolvedWebsiteMedia): ResolvedWebsiteMedia {
  // An illustration may establish visual context, but is never portfolio evidence.
  return { ...media, work: media.work.filter(item => item.source !== "matched") };
}
