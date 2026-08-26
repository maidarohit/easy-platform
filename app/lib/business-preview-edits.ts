import type { BusinessPreview } from "@/app/lib/business-preview";

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

export type PreviewEditableField = keyof typeof PREVIEW_EDIT_RULES;
export type PreviewOverrides = Partial<Record<PreviewEditableField, string>>;

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
  const entries = Object.entries(value);
  if (entries.length > Object.keys(PREVIEW_EDIT_RULES).length) {
    return { valid: false, error: "Too many preview fields were submitted." };
  }
  const overrides: PreviewOverrides = {};
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
    overrides[field] = normalized;
  }
  return { valid: true, overrides };
}

export function applyPreviewOverrides(preview: BusinessPreview, overrides: PreviewOverrides): BusinessPreview {
  const next = structuredClone(preview);
  for (const [rawField, value] of Object.entries(overrides)) {
    const field = rawField as PreviewEditableField;
    if (!Object.hasOwn(PREVIEW_EDIT_RULES, field) || typeof value !== "string") continue;
    const [section, key] = field.split(".") as ["brand" | "website" | "marketing" | "search" | "journey", string];
    const target = next[section] as Record<string, unknown> | null;
    if (target && typeof target[key] === "string") target[key] = value;
  }
  return next;
}
