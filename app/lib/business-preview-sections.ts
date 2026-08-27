import type { BusinessPreview } from "@/app/lib/business-preview";

const BUSINESS_PREVIEW_SECTIONS = [
  { key: "brand", label: "Brand", id: "brand" },
  { key: "website", label: "Website", id: "website" },
  { key: "marketing", label: "Marketing", id: "marketing" },
  { key: "search", label: "Search", id: "search" },
  { key: "journey", label: "Customer Journey", id: "customer-journey" },
] as const;

export function renderedBusinessPreviewSections(preview: BusinessPreview) {
  return BUSINESS_PREVIEW_SECTIONS
    .filter((section) => Boolean(preview[section.key]))
    .map((section) => ({ ...section, href: `#${section.id}` as const }));
}
