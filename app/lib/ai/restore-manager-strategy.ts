import type { AiManagerStrategy } from "./types";

const sectionKeys = ["overview", "branding", "website", "marketing", "seo", "uiux", "sales", "analytics"] as const;

// Saved module outputs contain the strategy directly; older job results can
// retain the output envelope. Normalize only at the display boundary.
export function restoreAiManagerStrategy(value: unknown, depth = 0): AiManagerStrategy | null {
  if (depth > 8) return null;
  if (typeof value === "string") {
    try {
      return restoreAiManagerStrategy(JSON.parse(value), depth + 1);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    return value.length === 1 ? restoreAiManagerStrategy(value[0], depth + 1) : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (sectionKeys.every((key) => Object.hasOwn(record, key) && typeof record[key] === "string" && record[key].trim())) {
    return Object.fromEntries(sectionKeys.map((key) => [key, record[key]])) as unknown as AiManagerStrategy;
  }
  const candidates = ["output", "result"].filter((key) => Object.hasOwn(record, key))
    .map((key) => restoreAiManagerStrategy(record[key], depth + 1))
    .filter((candidate): candidate is AiManagerStrategy => candidate !== null);
  const unique = new Map(candidates.map((candidate) => [JSON.stringify(candidate), candidate]));
  return unique.size === 1 ? unique.values().next().value ?? null : null;
}
