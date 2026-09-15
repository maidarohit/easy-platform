const INTERNAL_CATEGORY_VALUES = new Set([
  "small", "medium", "large", "micro", "enterprise",
  "startup", "start up", "early stage", "established", "existing",
  "generate leads", "book appointments", "sell products", "showcase portfolio",
]);

const NON_OFFERING_SERVICE_LABELS = new Set([
  "home", "homepage", "landing", "landing page",
  "services", "service", "service detail", "service detail page", "service detail pages",
  "pricing", "pricing package", "pricing packages",
  "book now", "book a consultation", "book consultation", "book a consult",
  "contact", "contact us", "send an enquiry", "send inquiry", "enquire", "inquire",
  "how it works", "process", "about", "faq", "blog",
  "package", "packages",
  "contact form", "enquiry form", "inquiry form", "quote form", "booking", "online booking",
  "project gallery", "gallery", "portfolio", "checkout", "site map", "page layout",
]);

const NON_OFFERING_SERVICE_PATTERN = /^(?:home|homepage|pricing|book now|contact us|send an enquiry|send inquiry|how it works|package|packages|contact form|enquiry form|inquiry form|quote form|booking|project gallery|gallery|portfolio|checkout|site map|page layout)$/i;
const INTERNAL_COPY = /\b(?:scope\s*,\s*process\s*,\s*sample deliverables|planning notes?|implementation notes?|primary objective|business goal|workflow state|system label|internal strategy)\b/i;
const GENERIC_TEMPLATE_COPY = /\b(?:designed around your business|professional brand direction|turn the idea into something real|services shaped around real needs|thoughtful work,? presented with clarity and purpose|purpose behind the work|ready to take the next step|tell us what you(?:'|’)re looking for(?: and we(?:'|’)ll help you find the right way forward)?|right way forward)\b/i;

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function strippedServiceTitle(value: string) {
  return value
    .split(/\s*>\s*/)
    .filter(Boolean)
    .at(-1)
    ?.replace(/^(?:service|product|offer)\s*\d*\s*[:\-]\s*/i, "")
    .trim() ?? "";
}

export function hasGenericWebsiteTemplateCopy(value: string | null | undefined) {
  return Boolean(value && GENERIC_TEMPLATE_COPY.test(value));
}

export function publicIndustryLabel(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 80 || INTERNAL_CATEGORY_VALUES.has(normalized(candidate)) || INTERNAL_COPY.test(candidate)) return null;
  const readable = candidate.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^[a-z\s]+$/.test(readable) || /^[A-Z\s]+$/.test(readable)) {
    return readable.charAt(0).toUpperCase() + readable.slice(1).toLowerCase();
  }
  return readable;
}

export function publicServiceTitle(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  const title = strippedServiceTitle(candidate);
  const label = normalized(title);
  return title && title.length >= 2 && title.length <= 100 && !INTERNAL_COPY.test(title) && !GENERIC_TEMPLATE_COPY.test(title) &&
    !NON_OFFERING_SERVICE_LABELS.has(label) && !NON_OFFERING_SERVICE_PATTERN.test(title) ? title : null;
}

export function concisePublicCopy(value: string | null | undefined, maximum = 280) {
  const candidate = value?.replace(/\s+/g, " ").trim();
  if (!candidate || INTERNAL_COPY.test(candidate) || GENERIC_TEMPLATE_COPY.test(candidate)) return null;
  if (candidate.length <= maximum) return candidate;
  const sentences = candidate.match(/[^.!?]+[.!?](?=\s|$)/g) ?? [];
  let selected = "";
  for (const sentence of sentences) {
    const next = `${selected} ${sentence.trim()}`.trim();
    if (next.length > maximum) break;
    selected = next;
    if (selected.length >= 100) break;
  }
  return selected || null;
}

export function publicServiceText(value: string | null | undefined) {
  if (!value) return null;
  const kept = value
    .split(/(?:\r?\n|;)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (INTERNAL_COPY.test(part) || GENERIC_TEMPLATE_COPY.test(part)) return null;
      const cleaned = part.replace(/^\s*(?:services?|products?|offers?)\s*>\s*/i, "").trim();
      const match = cleaned.match(/^([^:\-]{2,100})\s*[:\-]\s*(.+)$/);
      const title = publicServiceTitle(match?.[1] ?? cleaned);
      if (!title) return null;
      return match ? `${title}: ${match[2].trim()}` : title;
    })
    .filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join("; ") : null;
}

export function showcaseGridClass(count: number) {
  if (count <= 1) return "mx-auto max-w-4xl grid-cols-1";
  if (count === 2) return "md:grid-cols-2";
  return "md:grid-cols-2 lg:grid-cols-3";
}
