import type { BusinessPreview } from "@/app/lib/business-preview";
import { validatePublicContactSettings, type PublicContactSettings } from "@/app/lib/public-contact";

export type PublishedBusinessSnapshot = Readonly<{
  schemaVersion: 1 | 2;
  business: BusinessPreview["business"];
  brand: BusinessPreview["brand"];
  website: BusinessPreview["website"];
  marketing: BusinessPreview["marketing"];
  search: BusinessPreview["search"];
  journey: BusinessPreview["journey"];
  contact?: PublicContactSettings;
}>;

const RESERVED = new Set(["admin", "api", "business", "dashboard", "help", "login", "onboarding", "signup", "www", "_next"]);

export function normalizeBusinessSlug(value: string) {
  const slug = value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 63).replace(/-$/g, "");
  return slug.length >= 3 && !RESERVED.has(slug) ? slug : `business-${slug || "page"}`.slice(0, 63);
}

export function validateBusinessSlug(value: unknown) {
  return typeof value === "string" && value.length >= 3 && value.length <= 63 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !RESERVED.has(value) ? value : null;
}

export function buildPublishedBusinessSnapshot(preview: BusinessPreview, contact: PublicContactSettings = {}): PublishedBusinessSnapshot {
  return structuredClone({
    schemaVersion: 2 as const,
    business: preview.business,
    brand: preview.brand,
    website: preview.website,
    marketing: preview.marketing,
    search: preview.search,
    journey: preview.journey,
    contact,
  });
}

export function businessPreviewRevision(outputIds: readonly string[], customizationRevision: number, overrides: object) {
  const source = `${[...outputIds].sort().join("|")}|${customizationRevision}|${JSON.stringify(overrides)}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

function safeTree(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return typeof value === "string" ? value.length <= 25_000 : typeof value !== "number" || Number.isFinite(value);
  }
  if (depth > 6) return false;
  if (Array.isArray(value)) return value.length <= 50 && value.every((item) => safeTree(item, depth + 1));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, item]) => key !== "__proto__" && key !== "constructor" && safeTree(item, depth + 1));
}

export function validatePublishedBusinessSnapshot(value: unknown): PublishedBusinessSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = ["schemaVersion", "business", "brand", "website", "marketing", "search", "journey", "contact"];
  if ((record.schemaVersion !== 1 && record.schemaVersion !== 2) || Object.keys(record).some((key) => !keys.includes(key)) || !safeTree(value)) return null;
  if (record.schemaVersion === 1 && Object.hasOwn(record, "contact")) return null;
  if (record.schemaVersion === 2 && (!Object.hasOwn(record, "contact") || !validatePublicContactSettings(record.contact).valid)) return null;
  const business = record.business as Record<string, unknown> | undefined;
  return business && typeof business.name === "string" && business.name.trim()
    ? value as PublishedBusinessSnapshot : null;
}
