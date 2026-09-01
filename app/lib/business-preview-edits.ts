import type { BusinessPreview } from "@/app/lib/business-preview";
import { isUsableBusinessUploadedSrc } from "@/app/lib/business-site-visuals";

export const PREVIEW_EDIT_RULES = {
  "brand.tagline": { label: "Brand tagline", maximum: 180 },
  "brand.voice": { label: "Brand voice", maximum: 1_200 },
  "website.heroHeadline": { label: "Website headline", maximum: 180 },
  "website.supportingText": { label: "Website supporting text", maximum: 700 },
  "website.primaryCta": { label: "Primary button label", maximum: 100 },
  "website.about": { label: "About / value text", maximum: 1_800 },
  "marketing.positioning": { label: "Marketing positioning", maximum: 1_800 },
  "search.title": { label: "Search title", maximum: 180 },
  "search.description": { label: "Search description", maximum: 360 },
  "journey.primaryCta": { label: "Lead invitation", maximum: 600 },
} as const;

export const HERO_IMAGE_OVERRIDE_KEY = "heroImage";
export const SECONDARY_IMAGE_OVERRIDE_KEY = "secondaryImage";
export const BUSINESS_VIDEO_OVERRIDE_KEY = "businessVideo";
export const OWNER_MEDIA_OVERRIDE_KEYS = [
  HERO_IMAGE_OVERRIDE_KEY,
  SECONDARY_IMAGE_OVERRIDE_KEY,
  BUSINESS_VIDEO_OVERRIDE_KEY,
] as const;
export const OWNER_IMAGE_OVERRIDE_KEYS = [HERO_IMAGE_OVERRIDE_KEY, SECONDARY_IMAGE_OVERRIDE_KEY] as const;
export type OwnerImageOverrideKey = (typeof OWNER_IMAGE_OVERRIDE_KEYS)[number];
export type OwnerMediaOverrideKey = (typeof OWNER_MEDIA_OVERRIDE_KEYS)[number];

export type PreviewEditableField = keyof typeof PREVIEW_EDIT_RULES;
export type PreviewOverrides = Partial<Record<PreviewEditableField, string>> & {
  heroImage?: string;
  secondaryImage?: string;
  businessVideo?: string;
};

export function parseHeroImageOverride(value: unknown): string | null {
  return typeof value === "string" && isUsableBusinessUploadedSrc(value) ? value.trim() : null;
}

function copyTextOverrides(record: Record<string, unknown>): PreviewOverrides {
  const next: PreviewOverrides = {};
  for (const key of Object.keys(PREVIEW_EDIT_RULES) as PreviewEditableField[]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) next[key] = value;
  }
  return next;
}

function copyOwnerMedia(record: Record<string, unknown>): PreviewOverrides {
  const next: PreviewOverrides = {};
  for (const key of OWNER_MEDIA_OVERRIDE_KEYS) {
    const kept = parseHeroImageOverride(record[key]);
    if (kept) next[key] = kept;
  }
  return next;
}

export function withUpdatedOwnerImage(
  previous: unknown,
  key: OwnerMediaOverrideKey,
  mediaUrl: string,
): PreviewOverrides {
  const record = previous && typeof previous === "object" && !Array.isArray(previous)
    ? previous as Record<string, unknown>
    : {};
  return { ...copyTextOverrides(record), ...copyOwnerMedia(record), [key]: mediaUrl };
}

export function withUpdatedHeroImage(previous: unknown, heroImage: string): PreviewOverrides {
  return withUpdatedOwnerImage(previous, HERO_IMAGE_OVERRIDE_KEY, heroImage);
}

export function mergePreservedOwnerImages(overrides: PreviewOverrides, previous: unknown): PreviewOverrides {
  const previousRecord = previous && typeof previous === "object" && !Array.isArray(previous)
    ? previous as Record<string, unknown>
    : {};
  const next: PreviewOverrides = { ...overrides };
  for (const key of OWNER_MEDIA_OVERRIDE_KEYS) {
    if (next[key]) continue;
    const kept = parseHeroImageOverride(previousRecord[key]);
    if (kept) next[key] = kept;
  }
  return next;
}

export function mergePreservedHeroImage(overrides: PreviewOverrides, previous: unknown): PreviewOverrides {
  return mergePreservedOwnerImages(overrides, previous);
}

export function previewFieldValue(preview: BusinessPreview, field: PreviewEditableField) {
  const [section, key] = field.split(".") as ["brand" | "website" | "marketing" | "search" | "journey", string];
  const sectionValue = preview[section] as unknown as Record<string, unknown> | null;
  const value = sectionValue?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function validatePreviewOverrides(value: unknown, baseline: BusinessPreview):
  | { valid: true; overrides: PreviewOverrides }
  | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Your preview changes are not valid." };
  }
  const record = { ...(value as Record<string, unknown>) };
  const mediaRaw: Partial<Record<OwnerMediaOverrideKey, unknown>> = {
    heroImage: record[HERO_IMAGE_OVERRIDE_KEY],
    secondaryImage: record[SECONDARY_IMAGE_OVERRIDE_KEY],
    businessVideo: record[BUSINESS_VIDEO_OVERRIDE_KEY],
  };
  for (const key of OWNER_MEDIA_OVERRIDE_KEYS) delete record[key];
  const entries = Object.entries(record);
  if (entries.length > Object.keys(PREVIEW_EDIT_RULES).length) {
    return { valid: false, error: "Too many preview fields were submitted." };
  }
  const overrides: PreviewOverrides = {};
  for (const key of OWNER_MEDIA_OVERRIDE_KEYS) {
    if (mediaRaw[key] === undefined) continue;
    const media = parseHeroImageOverride(mediaRaw[key]);
    if (!media) return { valid: false, error: key === BUSINESS_VIDEO_OVERRIDE_KEY ? "That business video cannot be used." : "That business photo cannot be used." };
    overrides[key] = media;
  }
  for (const [key, raw] of entries) {
    if (!Object.hasOwn(PREVIEW_EDIT_RULES, key)) return { valid: false, error: "That preview field cannot be edited." };
    const field = key as PreviewEditableField;
    if (!previewFieldValue(baseline, field)) return { valid: false, error: "That preview field is not available to edit." };
    if (typeof raw !== "string") return { valid: false, error: `${PREVIEW_EDIT_RULES[field].label} must be plain text.` };
    const normalized = raw.trim();
    if (!normalized) return { valid: false, error: `${PREVIEW_EDIT_RULES[field].label} cannot be empty.` };
    if (normalized.length > PREVIEW_EDIT_RULES[field].maximum) return { valid: false, error: `${PREVIEW_EDIT_RULES[field].label} is too long.` };
    if (/[<>]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
      return { valid: false, error: `${PREVIEW_EDIT_RULES[field].label} must contain plain text only.` };
    }
    if (/\[[^\]\r\n]{1,80}\]/.test(normalized)) {
      return { valid: false, error: `${PREVIEW_EDIT_RULES[field].label} cannot contain unresolved placeholders.` };
    }
    overrides[field] = normalized;
  }
  return { valid: true, overrides };
}

export function applyPreviewOverrides(preview: BusinessPreview, overrides: PreviewOverrides): BusinessPreview {
  const next = structuredClone(preview);
  if (next.website) {
    if (overrides.heroImage) next.website.heroImage = overrides.heroImage;
    if (overrides.secondaryImage) next.website.secondaryImage = overrides.secondaryImage;
    if (overrides.businessVideo) next.website.businessVideo = overrides.businessVideo;
  }
  for (const [rawField, value] of Object.entries(overrides)) {
    if ((OWNER_MEDIA_OVERRIDE_KEYS as readonly string[]).includes(rawField)) continue;
    const field = rawField as PreviewEditableField;
    if (!Object.hasOwn(PREVIEW_EDIT_RULES, field) || typeof value !== "string") continue;
    const [section, key] = field.split(".") as ["brand" | "website" | "marketing" | "search" | "journey", string];
    const target = next[section] as Record<string, unknown> | null;
    if (target && typeof target[key] === "string") target[key] = value;
  }
  return next;
}
