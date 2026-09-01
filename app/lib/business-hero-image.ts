import { randomUUID } from "node:crypto";

import { withUpdatedOwnerImage, type OwnerImageOverrideKey, type PreviewOverrides } from "@/app/lib/business-preview-edits";

export const HERO_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const OWNER_IMAGE_MAX_BYTES = HERO_IMAGE_MAX_BYTES;

export type OwnerImageSlot = "hero" | "secondary";
export type HeroImageContentType = "image/jpeg" | "image/png" | "image/webp";

export const OWNER_IMAGE_SLOTS: Readonly<Record<OwnerImageSlot, { objectName: string; overrideKey: OwnerImageOverrideKey }>> = {
  hero: { objectName: "hero", overrideKey: "heroImage" },
  secondary: { objectName: "secondary", overrideKey: "secondaryImage" },
};

const MIME_BY_KIND: Readonly<Record<"jpeg" | "png" | "webp", HeroImageContentType>> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function parseOwnerImageSlot(value: unknown): OwnerImageSlot | null {
  return value === "hero" || value === "secondary" ? value : null;
}

export function heroObjectPath(userId: string, projectId: string) {
  return ownerImageObjectPath(userId, projectId, "hero");
}

export function ownerImageObjectPath(userId: string, projectId: string, slot: OwnerImageSlot) {
  return `business/${userId}/${projectId}/${OWNER_IMAGE_SLOTS[slot].objectName}`;
}

export function firebaseOwnerDownloadUrl(bucket: string, objectPath: string, downloadToken: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
}

export const firebaseHeroDownloadUrl = firebaseOwnerDownloadUrl;

function headerEquals(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectHeroImageKind(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length < 16) return null;
  if (headerEquals(bytes, [0xFF, 0xD8, 0xFF]) && bytes.includes(0xD9)) return "jpeg";
  if (
    headerEquals(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    && headerEquals(bytes, [0x49, 0x48, 0x44, 0x52], 12)
  ) return "png";
  if (
    headerEquals(bytes, [0x52, 0x49, 0x46, 0x46])
    && headerEquals(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    && headerEquals(bytes, [0x56, 0x50, 0x38], 12)
  ) return "webp";
  return null;
}

export function declaredHeroImageKind(mime: string | null): "jpeg" | "png" | "webp" | null {
  const normalized = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpeg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return null;
}

export function validateHeroImageBytes(
  bytes: Uint8Array,
  declaredMime: string | null,
): { valid: true; contentType: HeroImageContentType } | { valid: false; error: string } {
  if (bytes.length === 0) return { valid: false, error: "Choose a JPEG, PNG or WEBP photo." };
  if (bytes.length > HERO_IMAGE_MAX_BYTES) return { valid: false, error: "That photo is too large. Use an image under 4 MB." };
  const start = String.fromCharCode(...Array.from(bytes.slice(0, 64)));
  if (/^\s*</.test(start) || /<!doctype html|svg/i.test(start)) {
    return { valid: false, error: "Only JPEG, PNG or WEBP photos are allowed." };
  }
  const detected = detectHeroImageKind(bytes);
  const declared = declaredHeroImageKind(declaredMime);
  if (!detected) return { valid: false, error: "That file is not a valid JPEG, PNG or WEBP photo." };
  if (!declared || declared !== detected) {
    return { valid: false, error: "The photo type does not match the file contents." };
  }
  return { valid: true, contentType: MIME_BY_KIND[detected] };
}

export type HeroImageStorage = {
  saveHeroObject(input: {
    objectPath: string;
    bytes: Uint8Array;
    contentType: HeroImageContentType;
    downloadToken: string;
  }): Promise<string>;
};

type StorageFailure = {
  storageFailure?: {
    reason: "bucket-not-found" | "permission" | "credential" | "object-write";
    code: string | number | null;
    className: string;
    message: string;
    bucket: string;
  };
};

export async function runBusinessOwnerImageUpload(input: {
  slot: OwnerImageSlot;
  userId: string;
  projectId: string;
  bytes: Uint8Array;
  declaredMime: string | null;
  previousOverrides: unknown;
  storage: HeroImageStorage;
  persistOverrides: (overrides: PreviewOverrides) => Promise<PreviewOverrides>;
  createDownloadToken?: () => string;
}): Promise<
  | { ok: true; imageUrl: string; slot: OwnerImageSlot; overrides: PreviewOverrides }
  | { ok: false; status: number; error: string; debug?: StorageFailure["storageFailure"] }
> {
  const checked = validateHeroImageBytes(input.bytes, input.declaredMime);
  if (!checked.valid) return { ok: false, status: 400, error: checked.error };

  const downloadToken = input.createDownloadToken?.() ?? randomUUID();
  const spec = OWNER_IMAGE_SLOTS[input.slot];
  const objectPath = ownerImageObjectPath(input.userId, input.projectId, input.slot);
  let imageUrl: string;
  try {
    imageUrl = await input.storage.saveHeroObject({
      objectPath,
      bytes: input.bytes,
      contentType: checked.contentType,
      downloadToken,
    });
  } catch (error) {
    const debug = error && typeof error === "object" && "storageFailure" in error
      ? (error as StorageFailure).storageFailure
      : undefined;
    return {
      ok: false,
      status: 503,
      error: error instanceof Error && debug ? error.message : "Unable to save that photo. Please try again.",
      debug,
    };
  }

  try {
    const overrides = withUpdatedOwnerImage(input.previousOverrides, spec.overrideKey, imageUrl);
    const saved = await input.persistOverrides(overrides);
    return { ok: true, imageUrl, slot: input.slot, overrides: saved };
  } catch {
    return { ok: false, status: 500, error: "Unable to save that photo. Please try again." };
  }
}

export async function runBusinessHeroImageUpload(input: Omit<Parameters<typeof runBusinessOwnerImageUpload>[0], "slot">) {
  const result = await runBusinessOwnerImageUpload({ ...input, slot: "hero" });
  if (!result.ok) return result;
  return { ok: true as const, heroImage: result.imageUrl, overrides: result.overrides };
}
