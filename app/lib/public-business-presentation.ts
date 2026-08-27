import type { PublishedBusinessSnapshot } from "@/app/lib/business-publication";

const INTERNAL_PAGE_LABELS = new Set(["home", "services", "service detail page", "service detail pages", "portfolio", "portfolio case studies", "case studies", "pricing", "pricing packages", "process", "about", "contact", "faq", "blog"]);
const INTERNAL_PUBLIC_TEXT = /\b(?:day\s*\d+|outreach sequence|follow[- ]?up schedule|connection request|cold email|prospecting|sales script|implementation strategy|site ?map|page layout|individual pages?|wireframes?|deliverables and timeline|keyword strategy|meta titles?|meta descriptions?|kpis?|conversion rate|marketing score|ai agent|prompt|model output)\b/i;
const LABEL_PREFIX = /^(?:persona|audience|target audience|customer segment|step|phase|service|product|offer)\s*\d*\s*[:–—-]\s*/i;
const LIST_MARKER = /^\s*(?:[-*•]+|\d{1,2}[.)])\s*/;

function normalizedLabel(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function clean(value: string | null | undefined, maximum = 320) {
  const candidate = value?.replace(LIST_MARKER, "").replace(LABEL_PREFIX, "").trim();
  return candidate && candidate.length <= maximum && !INTERNAL_PUBLIC_TEXT.test(candidate) ? candidate : null;
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
    return label.length >= 3 && !INTERNAL_PAGE_LABELS.has(label) && !INTERNAL_PUBLIC_TEXT.test(`${item.title} ${item.description}`);
  }).slice(0, 6).map((item) => ({ title: item.title, description: clean(item.description) }));
  if (direct.length > 0) return direct;
  const sources = [snapshot.website?.services, snapshot.business.description, snapshot.website?.supportingText,
    snapshot.marketing?.positioning, snapshot.search?.keywords].filter((value): value is string => Boolean(value));
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
export function publicAudience(snapshot: PublishedBusinessSnapshot): PublicCard[] {
  const unique = new Map<string, PublicCard>();
  for (const value of [...pieces(snapshot.journey?.audience, 6), ...pieces(snapshot.marketing?.audience, 6)]) {
    const item = card(value); const key = normalizedLabel(item.title);
    if (key.length >= 3 && !unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 4);
}
export function publicProcess(snapshot: PublishedBusinessSnapshot) {
  const source = pieces(snapshot.journey?.customerJourney || snapshot.journey?.enquiryPath, 6).map((value) => card(value).title).filter((value) => value.length <= 90);
  if (source.length >= 3) return source;
  return /\b(?:shop|store|ecommerce|e-commerce|retail|product)\b/i.test(`${snapshot.business.industry} ${snapshot.website?.services}`)
    ? ["Explore the range", "Choose what fits", "Place your enquiry or order"]
    : ["Explore what we offer", "Tell us what you need", "Receive a tailored next step"];
}
export function publicValuePoints(snapshot: PublishedBusinessSnapshot): PublicCard[] {
  const candidates = [...pieces(snapshot.website?.trust, 5), ...pieces(snapshot.brand?.voice, 3), ...pieces(snapshot.website?.features, 5)];
  return candidates.map(card).filter((item, index, all) => all.findIndex((other) => normalizedLabel(other.title) === normalizedLabel(item.title)) === index).slice(0, 4);
}
export function publicBusinessKind(snapshot: PublishedBusinessSnapshot) {
  const context = `${snapshot.business.industry ?? ""} ${snapshot.business.description ?? ""} ${snapshot.website?.services ?? ""} ${snapshot.journey?.audience ?? ""}`.toLowerCase();
  if (/artist|art |painting|photograph|creative|interior design/.test(context)) return { workLabel: "Selected work", audienceLabel: "Created for", b2b: /commercial|corporate|office|hospitality|designer|agency/.test(context) };
  if (/cafe|restaurant|salon|spa|local/.test(context)) return { workLabel: "The experience", audienceLabel: "Made for our community", b2b: false };
  if (/manufactur|industrial|agency|b2b|enterprise|corporate/.test(context)) return { workLabel: "Capabilities", audienceLabel: "Who we work with", b2b: true };
  if (/shop|store|ecommerce|e-commerce|retail|product/.test(context)) return { workLabel: "Featured range", audienceLabel: "Designed for", b2b: false };
  if (/consult|coach|advisor|professional service/.test(context)) return { workLabel: "Expertise", audienceLabel: "Who we help", b2b: /business|company|enterprise/.test(context) };
  return { workLabel: "What we do", audienceLabel: "Who we serve", b2b: /business|company|commercial/.test(context) };
}
export function publicContact(snapshot: PublishedBusinessSnapshot) {
  const value = snapshot.website?.contact?.trim() || ""; const email = value.includes("@") ? value : null;
  const digits = value.replace(/[^+\d]/g, ""); const phone = !email && digits.length >= 7 ? digits : null;
  return { label: email || phone, href: email ? `mailto:${email}` : phone ? `tel:${phone}` : "#contact" };
}
export function publicSocialLinks(snapshot: PublishedBusinessSnapshot) {
  void snapshot;
  // Schema v1 has no verified social-connection URLs. Strategy mentions are never treated as accounts.
  return [] as readonly Readonly<{ href: string; label: string }>[];
}
export function publicStory(snapshot: PublishedBusinessSnapshot) { return clean(snapshot.website?.about, 900) || clean(snapshot.brand?.story, 900) || clean(snapshot.business.description, 650); }
