import type { PublishedBusinessSnapshot } from "@/app/lib/business-publication";

const INTERNAL_PAGE_LABELS = new Set([
  "home", "services", "service detail page", "service detail pages", "portfolio",
  "portfolio case studies", "case studies", "pricing", "pricing packages", "process",
  "about", "contact", "faq", "blog",
]);

const INTERNAL_PUBLIC_TEXT = /\b(?:day\s*\d+|outreach sequence|follow[- ]?up schedule|connection request|cold email|prospecting|sales script|implementation strategy|site ?map|page layout|individual pages?|wireframes?|deliverables and timeline)\b/i;
const SERVICE_PHRASES = [
  /\bbrand strategy\b/gi,
  /\bbranding services?\b/gi,
  /\bwebsite design(?:\s*(?:&|and)\s*development)?\b/gi,
  /\bwebsite development\b/gi,
  /\bsocial media management\b/gi,
  /\blocal seo\b/gi,
  /\bsearch engine optimization\b/gi,
  /\bdigital marketing\b/gi,
] as const;

function normalizedLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function safePublicText(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && !INTERNAL_PUBLIC_TEXT.test(candidate) ? candidate : null;
}

export type PublicService = Readonly<{ title: string; description: string | null }>;

export function publicServices(snapshot: PublishedBusinessSnapshot): PublicService[] {
  const direct = (snapshot.website?.serviceCards ?? []).filter((card) => {
    const label = normalizedLabel(card.title);
    return label.length >= 3 && !INTERNAL_PAGE_LABELS.has(label) && !INTERNAL_PUBLIC_TEXT.test(`${card.title} ${card.description}`);
  }).slice(0, 6).map((card) => ({ title: card.title, description: safePublicText(card.description) }));
  if (direct.length > 0) return direct;

  const sources = [
    snapshot.website?.services,
    snapshot.business.description,
    snapshot.website?.supportingText,
    snapshot.marketing?.positioning,
    snapshot.search?.keywords,
  ].filter((value): value is string => Boolean(value));
  const found = new Map<string, string>();
  for (const source of sources) {
    for (const pattern of SERVICE_PHRASES) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const title = match[0].trim();
        const key = normalizedLabel(title);
        if (!found.has(key)) found.set(key, `${title.charAt(0).toUpperCase()}${title.slice(1)}`);
      }
    }
  }
  return [...found.values()].slice(0, 6).map((title) => ({ title, description: null }));
}

export function publicServicesSummary(snapshot: PublishedBusinessSnapshot) {
  return safePublicText(snapshot.business.description) || safePublicText(snapshot.website?.supportingText);
}

export function publicCallToAction(snapshot: PublishedBusinessSnapshot) {
  return safePublicText(snapshot.website?.primaryCta) || "Get in Touch";
}
