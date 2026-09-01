import "server-only";

import { firebaseOwnerDownloadUrl } from "@/app/lib/business-hero-image";
import type { BusinessVideoStorage } from "@/app/lib/business-owner-video";
import { getFirebaseAdminStorageBucket } from "@/app/lib/firebase-admin";
import { classifyFirebaseStorageError, ownerPhotoStorageUserMessage } from "@/app/lib/firebase-storage-error";

export async function saveBusinessHeroObject(input: {
  objectPath: string;
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  downloadToken: string;
}) {
  const bucket = getFirebaseAdminStorageBucket();
  try {
    await bucket.file(input.objectPath).save(Buffer.from(input.bytes), {
      resumable: false,
      public: false,
      metadata: {
        contentType: input.contentType,
        cacheControl: "private, max-age=0, no-transform",
        metadata: {
          firebaseStorageDownloadTokens: input.downloadToken,
        },
      },
    });
  } catch (error) {
    const failure = classifyFirebaseStorageError(error, bucket.name);
    const wrapped = new Error(ownerPhotoStorageUserMessage(failure));
    (wrapped as Error & { storageFailure: typeof failure }).storageFailure = failure;
    throw wrapped;
  }
  return firebaseOwnerDownloadUrl(bucket.name, input.objectPath, input.downloadToken);
}

export const firebaseBusinessVideoStorage: BusinessVideoStorage = {
  async createSignedUploadUrl(input) {
    const bucket = getFirebaseAdminStorageBucket();
    const requiredHeaders = {
      "Content-Type": input.contentType,
      "x-goog-content-length-range": `1,${input.maxBytes}`,
    };
    const [uploadUrl] = await bucket.file(input.objectPath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: input.expiresAt,
      contentType: input.contentType,
      extensionHeaders: {
        "x-goog-content-length-range": `1,${input.maxBytes}`,
      },
    });
    return { uploadUrl, requiredHeaders };
  },

  async getObject(objectPath) {
    const file = getFirebaseAdminStorageBucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return { exists: false, size: 0, contentType: null };
    const [metadata] = await file.getMetadata();
    return {
      exists: true,
      size: Number(metadata.size ?? 0),
      contentType: typeof metadata.contentType === "string" ? metadata.contentType : null,
    };
  },

  async readPrefix(objectPath, byteCount) {
    const file = getFirebaseAdminStorageBucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of file.createReadStream({ start: 0, end: Math.max(byteCount - 1, 0) })) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Uint8Array.from(Buffer.concat(chunks));
  },

  async deleteObject(objectPath) {
    await getFirebaseAdminStorageBucket().file(objectPath).delete({ ignoreNotFound: true });
  },

  async publishObject(input) {
    const bucket = getFirebaseAdminStorageBucket();
    const destination = bucket.file(input.destinationPath);
    await bucket.file(input.sourcePath).copy(destination);
    await destination.setMetadata({
      contentType: input.contentType,
      cacheControl: "private, max-age=0, no-transform",
      metadata: {
        firebaseStorageDownloadTokens: input.downloadToken,
      },
    });
    await bucket.file(input.sourcePath).delete({ ignoreNotFound: true });
    return firebaseOwnerDownloadUrl(bucket.name, input.destinationPath, input.downloadToken);
  },
};
