import { randomUUID } from "node:crypto";

import { BUSINESS_VIDEO_OVERRIDE_KEY, withUpdatedOwnerImage, type PreviewOverrides } from "@/app/lib/business-preview-edits";
import { firebaseOwnerDownloadUrl } from "@/app/lib/business-hero-image";

export const BUSINESS_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const BUSINESS_VIDEO_SIGNED_UPLOAD_MS = 15 * 60 * 1000;
export type BusinessVideoContentType = "video/mp4" | "video/webm";

export function ownerVideoObjectPath(userId: string, projectId: string) {
  return `business/${userId}/${projectId}/video`;
}

export function ownerVideoIncomingObjectPath(userId: string, projectId: string) {
  return `${ownerVideoObjectPath(userId, projectId)}.incoming`;
}

export function declaredBusinessVideoKind(mime: string | null): "mp4" | "webm" | null {
  const normalized = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "video/mp4") return "mp4";
  if (normalized === "video/webm") return "webm";
  return null;
}

export function detectBusinessVideoKind(bytes: Uint8Array): "mp4" | "webm" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return "webm";
  const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (brand === "ftyp") return "mp4";
  return null;
}

export function validateBusinessVideoHeader(
  bytes: Uint8Array,
  declaredMime: string | null,
): { valid: true; contentType: BusinessVideoContentType } | { valid: false; error: string } {
  const declared = declaredBusinessVideoKind(declaredMime);
  const detected = detectBusinessVideoKind(bytes);
  if (!declared) return { valid: false, error: "Only MP4 or WEBM video is allowed." };
  if (!detected) return { valid: false, error: "That file is not a valid MP4 or WEBM video." };
  if (declared !== detected) return { valid: false, error: "The video type does not match the file contents." };
  return { valid: true, contentType: declared === "mp4" ? "video/mp4" : "video/webm" };
}

export function authorizeBusinessVideoSign(input: {
  ownerUserId: string;
  projectOwnerId: string | null;
  declaredMime: string | null;
  byteSize: number;
}): { ok: true; contentType: BusinessVideoContentType } | { ok: false; status: number; error: string } {
  if (!input.projectOwnerId || input.projectOwnerId !== input.ownerUserId) {
    return { ok: false, status: 404, error: "Project not found." };
  }
  const declared = declaredBusinessVideoKind(input.declaredMime);
  if (!declared) return { ok: false, status: 400, error: "Only MP4 or WEBM video is allowed." };
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    return { ok: false, status: 400, error: "Choose an MP4 or WEBM video." };
  }
  if (input.byteSize > BUSINESS_VIDEO_MAX_BYTES) {
    return { ok: false, status: 400, error: "That video is too large. Use a file under 50 MB." };
  }
  return { ok: true, contentType: declared === "mp4" ? "video/mp4" : "video/webm" };
}

export type BusinessVideoStorage = {
  createSignedUploadUrl(input: {
    objectPath: string;
    contentType: BusinessVideoContentType;
    maxBytes: number;
    expiresAt: Date;
  }): Promise<{ uploadUrl: string; requiredHeaders: Record<string, string> }>;
  getObject(objectPath: string): Promise<{ exists: boolean; size: number; contentType: string | null }>;
  readPrefix(objectPath: string, byteCount: number): Promise<Uint8Array | null>;
  deleteObject(objectPath: string): Promise<void>;
  publishObject(input: {
    sourcePath: string;
    destinationPath: string;
    downloadToken: string;
    contentType: BusinessVideoContentType;
  }): Promise<string>;
};

export async function runBusinessVideoSign(input: {
  userId: string;
  projectId: string;
  projectOwnerId: string | null;
  declaredMime: string | null;
  byteSize: number;
  storage: BusinessVideoStorage;
  now?: Date;
}): Promise<
  | {
    ok: true;
    objectPath: string;
    contentType: BusinessVideoContentType;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
    maxBytes: number;
    expiresAt: string;
  }
  | { ok: false; status: number; error: string }
> {
  const allowed = authorizeBusinessVideoSign({
    ownerUserId: input.userId,
    projectOwnerId: input.projectOwnerId,
    declaredMime: input.declaredMime,
    byteSize: input.byteSize,
  });
  if (!allowed.ok) return allowed;
  const expiresAt = new Date((input.now ?? new Date()).getTime() + BUSINESS_VIDEO_SIGNED_UPLOAD_MS);
  const objectPath = ownerVideoIncomingObjectPath(input.userId, input.projectId);
  const signed = await input.storage.createSignedUploadUrl({
    objectPath,
    contentType: allowed.contentType,
    maxBytes: BUSINESS_VIDEO_MAX_BYTES,
    expiresAt,
  });
  return {
    ok: true,
    objectPath,
    contentType: allowed.contentType,
    uploadUrl: signed.uploadUrl,
    requiredHeaders: signed.requiredHeaders,
    maxBytes: BUSINESS_VIDEO_MAX_BYTES,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function runBusinessVideoFinalize(input: {
  userId: string;
  projectId: string;
  projectOwnerId: string | null;
  objectPath: string;
  declaredMime: string | null;
  previousOverrides: unknown;
  storage: BusinessVideoStorage;
  persistOverrides: (overrides: PreviewOverrides) => Promise<PreviewOverrides>;
  createDownloadToken?: () => string;
}): Promise<
  | { ok: true; businessVideo: string; overrides: PreviewOverrides }
  | { ok: false; status: number; error: string }
> {
  if (!input.projectOwnerId || input.projectOwnerId !== input.userId) {
    return { ok: false, status: 404, error: "Project not found." };
  }
  const expectedIncoming = ownerVideoIncomingObjectPath(input.userId, input.projectId);
  const expectedFinal = ownerVideoObjectPath(input.userId, input.projectId);
  if (input.objectPath !== expectedIncoming && input.objectPath !== expectedFinal) {
    return { ok: false, status: 400, error: "That video upload is not valid for this business." };
  }
  const incomingPath = expectedIncoming;
  const object = await input.storage.getObject(incomingPath);
  if (!object.exists) return { ok: false, status: 400, error: "Upload the video before saving it." };
  if (object.size > BUSINESS_VIDEO_MAX_BYTES) {
    await input.storage.deleteObject(incomingPath);
    return { ok: false, status: 400, error: "That video is too large. Use a file under 50 MB." };
  }
  const prefix = await input.storage.readPrefix(incomingPath, 32);
  if (!prefix) {
    await input.storage.deleteObject(incomingPath);
    return { ok: false, status: 400, error: "That file is not a valid MP4 or WEBM video." };
  }
  const checked = validateBusinessVideoHeader(prefix, object.contentType || input.declaredMime);
  if (!checked.valid) {
    await input.storage.deleteObject(incomingPath);
    return { ok: false, status: 400, error: checked.error };
  }
  try {
    const downloadToken = input.createDownloadToken?.() ?? randomUUID();
    const businessVideo = await input.storage.publishObject({
      sourcePath: incomingPath,
      destinationPath: expectedFinal,
      downloadToken,
      contentType: checked.contentType,
    });
    const overrides = withUpdatedOwnerImage(input.previousOverrides, BUSINESS_VIDEO_OVERRIDE_KEY, businessVideo);
    const saved = await input.persistOverrides(overrides);
    return { ok: true, businessVideo, overrides: saved };
  } catch {
    return { ok: false, status: 500, error: "Unable to save that video. Please try again." };
  }
}

export { firebaseOwnerDownloadUrl };
