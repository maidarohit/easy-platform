/** Exact default bucket from the existing client Firebase config. Do not rewrite .firebasestorage.app to .appspot.com. */
export const FIREBASE_PROJECT_STORAGE_BUCKET = "easy-platform-b757b.firebasestorage.app";

export function firebaseStorageBucketName() {
  const configured = process.env.FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//i, "");
  if (configured) return configured;
  return FIREBASE_PROJECT_STORAGE_BUCKET;
}
