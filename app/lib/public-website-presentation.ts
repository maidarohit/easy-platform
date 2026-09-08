const INTERNAL_CATEGORY_VALUES = new Set([
  "small", "medium", "large", "micro", "enterprise",
  "startup", "start up", "early stage", "established", "existing",
  "generate leads", "book appointments", "sell products", "showcase portfolio",
]);

const INTERNAL_COPY = /\b(?:scope\s*,\s*process\s*,\s*sample deliverables|planning notes?|implementation notes?|primary objective|business goal|workflow state|system label|internal strategy)\b/i;

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
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
  const title = candidate.split(/\s*>\s*/).filter(Boolean).at(-1)?.replace(/^(?:service|product|offer)\s*\d*\s*[:–—-]\s*/i, "").trim();
  return title && title.length >= 2 && title.length <= 100 && !INTERNAL_COPY.test(title) ? title : null;
}

export function concisePublicCopy(value: string | null | undefined, maximum = 280) {
  const candidate = value?.replace(/\s+/g, " ").trim();
  if (!candidate || INTERNAL_COPY.test(candidate)) return null;
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
  return value?.split(/(\r?\n|;)/).map((part) => /^(?:\r?\n|;)$/.test(part)
    ? part
    : INTERNAL_COPY.test(part) ? "" : part.replace(/^\s*(?:services?|products?|offers?)\s*>\s*/i, "").trim()).join("") || null;
}

export function showcaseGridClass(count: number) {
  if (count <= 1) return "mx-auto max-w-4xl grid-cols-1";
  if (count === 2) return "md:grid-cols-2";
  return "md:grid-cols-2 lg:grid-cols-3";
}
