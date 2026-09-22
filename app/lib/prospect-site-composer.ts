import type { ProspectInput } from "./prospect-preview-core";
import { isUsableBusinessUploadedSrc, type WebsiteMediaInput } from "./business-site-visuals";
import { safeWebsiteBlockText } from "./website-site-presentation";
import { validateWebsiteSiteDocument, type WebsiteBlock } from "./website-site-document";

export type ProspectRenderMetadata = {
  version: 1;
  mode: "authored";
  industry: string;
  description: string;
  media: WebsiteMediaInput;
  services: { id: string; title: string; description: string }[];
};

// The internal caller supplies verified assets, never model-selected remote URLs.
export function validateProspectMedia(value: unknown): WebsiteMediaInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: WebsiteMediaInput = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!["hero", "about", "services", "work"].includes(key)) return null;
    const items = typeof raw === "string" ? [raw] : raw;
    if (!Array.isArray(items) || items.length > 6 || items.some(item => typeof item !== "string" || !isUsableBusinessUploadedSrc(item))) return null;
    result[key as keyof WebsiteMediaInput] = items.map(item => item.trim());
  }
  return result;
}

export function validateProspectRenderMetadata(value: unknown): ProspectRenderMetadata | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const media = validateProspectMedia(record.media);
  if (record.version !== 1 || record.mode !== "authored" || !media ||
      typeof record.industry !== "string" || record.industry.length > 200 ||
      typeof record.description !== "string" || record.description.length > 1500 ||
      !Array.isArray(record.services) || record.services.length > 12) return null;
  const services: ProspectRenderMetadata["services"] = [];
  for (const item of record.services) {
    if (!item || typeof item.id !== "string" || !/^service-\d+$/.test(item.id) ||
        typeof item.title !== "string" || !safeWebsiteBlockText(item.title, 160) ||
        typeof item.description !== "string" || !safeWebsiteBlockText(item.description, 500)) return null;
    services.push({ id: item.id, title: item.title, description: item.description });
  }
  return { version: 1, mode: "authored", industry: record.industry, description: record.description, media, services };
}

// Strategy is a design hint, never a source of business facts. A future structured
// generation adapter can supply this same document/render contract.
export function composeProspectSite(input: ProspectInput, design: {
  template: string; colorPalette: string; typography: string; structure: string;
}) {
  const name = input.companyName;
  const description = safeWebsiteBlockText(input.businessDescription, 1500);
  const sourceSentences = description.split(/(?<=[.!?])\s+/);
  const services = [...new Set(input.services)].filter(title => safeWebsiteBlockText(title, 160))
    .map((title, index) => {
      const sourceDescription = sourceSentences.find(sentence => sentence.length > title.length &&
        sentence.toLowerCase().includes(title.toLowerCase()) && safeWebsiteBlockText(sentence, 500));
      const guidance = [
        `Discuss your requirements for ${title} and the options available.`,
        `Ask about the scope and availability of ${title} before planning your next step.`,
        `Explore ${title} and the details that matter for your requirements.`,
      ];
      return { id: `service-${index}`, title, description: sourceDescription || guidance[index % guidance.length] };
    });
  const contact = [input.location, input.email, input.phone].filter(Boolean).join(" · ");
  const blocks: WebsiteBlock[] = [];
  const add = (block: WebsiteBlock) => blocks.push({ ...block, order: blocks.length });
  const base = { order: 0, visibility: "visible" as const };
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  const introduction = firstSentence || (description.length <= 500 ? description : "");
  const destination = services.length ? "#services" : description ? "#about" : "#contact";
  add({ ...base, id: "hero", type: "hero", headline: name,
    description: introduction || (services.length ? `Explore ${services.slice(0, 3).map(item => item.title).join(", ")}.` : "Explore the business and find the information you need."),
    ctaLabel: services.length ? "Explore our services" : "Discover more", ctaHref: destination });
  if (description && description !== introduction) add({ ...base, id: "about", type: "content", heading: "A closer look", body: description });
  // Keep a concise source description in About when the hero introduces offerings.
  else if (description && services.length) {
    (blocks[0] as Extract<WebsiteBlock, { type: "hero" }>).description = `Explore ${services.slice(0, 3).map(item => item.title).join(", ")}.`;
    add({ ...base, id: "about", type: "content", heading: "What we do", body: description });
  }
  if (services.length) add({ ...base, id: "services", type: "services", heading: "Explore our services",
    introduction: "Find the right starting point for your requirements.", serviceIds: services.map(item => item.id) });
  if (services.length && /\b(process|steps|how it works)\b/i.test(design.structure)) {
    add({ ...base, id: "process", type: "process", heading: "Plan your enquiry", steps: [
      { id: "needs", title: "Outline your needs", body: "Describe what you are looking for and the questions you want to explore." },
      { id: "options", title: "Discuss the options", body: "Ask about scope, availability and any requirements before deciding." },
      { id: "next", title: "Confirm next steps", body: "Request the details you need to make an informed decision." },
    ] });
  }
  if (services.length && contact) add({ ...base, id: "faq", type: "faq", heading: "Useful information", items: [
    { id: "offerings", question: "Which services can I ask about?", answer: services.map(item => item.title).join("; ") + "." },
    { id: "enquiry", question: "What should I include in an enquiry?", answer: "Describe the service you are interested in, your requirements and any questions you would like answered." },
  ] });
  add({ ...base, id: "cta", type: "cta", heading: "Have something in mind?",
    body: "Bring your questions and requirements to the conversation.", label: "Find contact details", href: "#contact" });
  add({ ...base, id: "contact", type: "contact", heading: "Get in touch",
    body: contact || "Contact details have not been supplied for this concept." });
  const siteDocument = validateWebsiteSiteDocument({ schemaVersion: 2,
    theme: { template: design.template, colorPalette: design.colorPalette, typography: design.typography },
    branding: { name, voice: "" }, navigation: { items: [] },
    header: { brandLabel: name, ctaLabel: "Get in touch", ctaHref: "#contact" },
    footer: { businessName: name, description: "", showContact: false },
    pages: [{ id: "home", type: "home", path: "/", title: "Home", order: 0, visibility: "visible",
      seo: { title: name.slice(0, 70), description: "Private website concept", canonicalPath: "/", index: false }, blocks }],
  });
  if (!siteDocument) return null;
  const prospectRender: ProspectRenderMetadata = { version: 1, mode: "authored", industry: input.businessType,
    description, media: input.media ?? {}, services };
  return { siteDocument, prospectRender };
}
