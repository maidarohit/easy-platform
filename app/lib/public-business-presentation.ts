import type { PublishedBusinessSnapshot } from "@/app/lib/business-publication";
import { publicContactMethods } from "@/app/lib/public-contact";

const INTERNAL_PAGE_LABELS = new Set(["home", "homepage", "landing", "landing page", "services", "service detail", "service detail page", "service detail pages", "portfolio", "portfolio case studies", "case studies", "project detail", "project details", "pricing", "pricing packages", "process", "about", "contact", "faq", "blog"]);
const INTERNAL_PUBLIC_TEXT = /\b(?:primary objective|segmentation|lead scoring|day\s*\d+|outreach sequence|follow[- ]?up schedule|connection request|cold email|prospecting|sales script|implementation strategy|implementation notes?|content calendar|campaign timeline|customer acquisition|analytics strategy|site ?map|page layout|individual pages?|wireframes?|deliverables and timeline|keyword(?:s| research| strategy)?|meta titles?|meta descriptions?|kpis?|conversion rate|conversion flow|marketing score|ai manager|ai agent|prompt|raw json|model output)\b/i;
const UNSAFE_FACT_TEXT = /(?:\$\s*[xX]\b|\bTBD\b|\b(?:free|growth|pro)\s+plans?\b|\btestimonials?\b|\b(?:award(?:ed|s)?|certif(?:ied|ication|ications))\b|\bguaranteed?\b|\b\d+(?:\.\d+)?%\b|\b\d+\+?\s+(?:customers?|clients?|projects?|years?)\b)/i;
const LABEL_PREFIX = /^(?:persona|audience|target audience|customer segment|step|phase|service|product|offer)\s*\d*\s*[:–—-]\s*/i;
const LIST_MARKER = /^\s*(?:[-*•]+|\d{1,2}[.)])\s*/;

function normalizedLabel(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function clean(value: string | null | undefined, maximum = 320) {
  const candidate = value?.replace(LIST_MARKER, "").replace(LABEL_PREFIX, "").trim();
  if (!candidate || candidate.length > maximum || INTERNAL_PUBLIC_TEXT.test(candidate) ||
      UNSAFE_FACT_TEXT.test(candidate) || /(?:\.\.\.|…|â€¦)\s*$/.test(candidate)) return null;
  const paragraphs = candidate.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).filter(Boolean);
  return paragraphs.filter((item, index) => paragraphs.findIndex((other) => normalizedLabel(other) === normalizedLabel(item)) === index).join("\n\n") || null;
}
function pieces(value: string | null | undefined, maximum = 6) {
  if (!value) return [];
  return value.split(/(?:\r?\n|;|\s+[→|]\s+|\s+(?=\d{1,2}[.)]\s))/).map((item) => clean(item))
    .filter((item): item is string => Boolean(item)).slice(0, maximum);
}
function card(value: string) {
  const match = value.match(/^([^:–—]{2,80})\s*[:–—]\s*(.+)$/);
  return match ? { title: match[1].trim(), description: clean(match[2]) } : { title: value, description: null };
}

export type PublicService = Readonly<{ title: string; description: string | null }>;
export type PublicCard = Readonly<{ title: string; description: string | null }>;
const SERVICE_PHRASES = [
  /\b(?:custom )?portraits?\b/gi, /\bcanvas (?:art|artwork|paintings?)\b/gi, /\bwall murals?\b/gi,
  /\bbrand strategy\b/gi, /\bbranding services?\b/gi, /\bwebsite design(?:\s*(?:&|and)\s*development)?\b/gi,
  /\bwebsite development\b/gi, /\bsocial media management\b/gi, /\blocal seo\b/gi,
  /\bsearch engine optimization\b/gi, /\bdigital marketing\b/gi, /\bconsult(?:ing|ation)\b/gi,
  /\binterior design\b/gi, /\bmanufactur(?:ing|ing services?)\b/gi,
] as const;

export function publicServices(snapshot: PublishedBusinessSnapshot): PublicService[] {
  const direct = (snapshot.website?.serviceCards ?? []).filter((item) => {
    const label = normalizedLabel(item.title);
    return label.length >= 3 && !INTERNAL_PAGE_LABELS.has(label) && Boolean(clean(item.title, 80)) &&
      !INTERNAL_PUBLIC_TEXT.test(`${item.title} ${item.description}`);
  }).slice(0, 6).map((item) => ({ title: clean(item.title, 80)!, description: clean(item.description) ?? "" }));
  if (direct.length > 0) return direct;
  const savedItems = pieces(snapshot.website?.services, 6).map(card).filter((item) => {
    const label = normalizedLabel(item.title);
    return label.length >= 3 && !INTERNAL_PAGE_LABELS.has(label) && Boolean(clean(item.title, 80));
  }).map((item) => ({ title: clean(item.title, 80)!, description: clean(item.description) }));
  if (savedItems.length > 0) return savedItems;
  const sources = [snapshot.website?.services, snapshot.business.description, snapshot.website?.supportingText]
    .filter((value): value is string => Boolean(value));
  const found = new Map<string, string>();
  for (const source of sources) for (const pattern of SERVICE_PHRASES) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const title = match[0].trim(); const key = normalizedLabel(title);
      if (!found.has(key)) found.set(key, title.charAt(0).toUpperCase() + title.slice(1));
    }
  }
  return [...found.values()].slice(0, 6).map((title) => ({ title, description: null }));
}

export function publicServicesSummary(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.business.description, 650) || clean(snapshot.website?.supportingText, 650); }
export function publicCallToAction(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.website?.primaryCta, 80) || "Get in Touch"; }
export function publicHeroCopy(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.website?.supportingText, 650) || clean(snapshot.business.description, 650); }
export function publicSeoDescription(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.search?.description, 650) || publicHeroCopy(snapshot) || undefined; }
export function publicBusinessView(snapshot: PublishedBusinessSnapshot): PublishedBusinessSnapshot {
  const website = snapshot.website ? {
    ...snapshot.website,
    heroHeadline: clean(snapshot.website.heroHeadline, 160),
    supportingText: clean(snapshot.website.supportingText, 650),
    primaryCta: clean(snapshot.website.primaryCta, 80),
    services: clean(snapshot.website.services, 900),
    serviceCards: publicServices(snapshot).map((item) => ({ ...item, description: item.description ?? "" })),
    trust: clean(snapshot.website.trust, 650),
    about: clean(snapshot.website.about, 900),
    features: clean(snapshot.website.features, 800),
    contact: null,
  } : null;
  return {
    ...snapshot,
    business: { ...snapshot.business, industry: clean(snapshot.business.industry, 120),
      goal: null, description: clean(snapshot.business.description, 650) },
    brand: snapshot.brand ? { ...snapshot.brand, tagline: clean(snapshot.brand.tagline, 180),
      colourDirection: null, typography: null, voice: null, logoConcept: null,
      story: clean(snapshot.brand.story, 900) } : null,
    website,
    marketing: null,
    search: snapshot.search ? { positioning: null, keywords: null, keywordTags: [], localFocus: null,
      title: clean(snapshot.search.title, 120), description: clean(snapshot.search.description, 650) } : null,
    journey: null,
  };
}
export function publicAudience(_snapshot: PublishedBusinessSnapshot): PublicCard[] { return []; }
export function publicProcess(snapshot: PublishedBusinessSnapshot) {
  return /\b(?:shop|store|ecommerce|e-commerce|retail|product)\b/i.test(`${snapshot.business.industry} ${snapshot.website?.services}`)
    ? ["Explore the range", "Choose what fits", "Place your enquiry or order"]
    : ["Explore what we offer", "Tell us what you need", "Receive a tailored next step"];
}
export function publicValuePoints(snapshot: PublishedBusinessSnapshot): PublicCard[] {
  const candidates = [...pieces(snapshot.website?.trust, 5), ...pieces(snapshot.website?.features, 5)];
  return candidates.map(card).filter((item, index, all) => all.findIndex((other) => normalizedLabel(other.title) === normalizedLabel(item.title)) === index).slice(0, 4);
}
export function publicBusinessKind(snapshot: PublishedBusinessSnapshot) {
  const context = `${snapshot.business.industry ?? ""} ${snapshot.business.description ?? ""} ${snapshot.website?.services ?? ""}`.toLowerCase();
  if (/artist|art |painting|photograph|creative|interior design/.test(context)) return { workLabel: "Selected work", audienceLabel: "Created for", b2b: /commercial|corporate|office|hospitality|designer|agency/.test(context) };
  if (/cafe|restaurant|salon|spa|local/.test(context)) return { workLabel: "The experience", audienceLabel: "Made for our community", b2b: false };
  if (/manufactur|industrial|agency|b2b|enterprise|corporate/.test(context)) return { workLabel: "Capabilities", audienceLabel: "Who we work with", b2b: true };
  if (/shop|store|ecommerce|e-commerce|retail|product/.test(context)) return { workLabel: "Featured range", audienceLabel: "Designed for", b2b: false };
  if (/consult|coach|advisor|professional service/.test(context)) return { workLabel: "Expertise", audienceLabel: "Who we help", b2b: /business|company|enterprise/.test(context) };
  return { workLabel: "What we do", audienceLabel: "Who we serve", b2b: /business|company|commercial/.test(context) };
}
export function publicContact(snapshot: PublishedBusinessSnapshot) {
  const methods = publicContactMethods(snapshot.contact ?? {});
  if (methods.length) return { label: methods[0].value, href: methods[0].href, methods, location: snapshot.contact?.location ?? null };
  // Legacy generated website.contact text was never explicit publication consent.
  return { label: null, href: "#contact", methods: [], location: null };
}
export function publicSocialLinks(snapshot: PublishedBusinessSnapshot) {
  return publicContactMethods(snapshot.contact ?? {}).filter((item) => ["Instagram", "Facebook", "LinkedIn"].includes(item.label));
}
export function publicStory(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.website?.about, 900) || clean(snapshot.brand?.story, 900) || clean(snapshot.business.description, 650); }
