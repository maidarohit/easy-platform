export type ClassifiedStorageFailure = {
  reason: "bucket-not-found" | "permission" | "credential" | "object-write";
  code: string | number | null;
  className: string;
  message: string;
  bucket: string;
};

function redactStorageMessage(value: string) {
  return value
    .replace(/token=[^&\s"']+/gi, "token=redacted")
    .replace(/Bearer\s+\S+/gi, "Bearer redacted")
    .replace(/-----BEGIN[\s\S]+?-----END [A-Z ]+-----/g, "[redacted]")
    .slice(0, 220);
}

export function classifyFirebaseStorageError(error: unknown, bucket: string): ClassifiedStorageFailure {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof record.code === "string" || typeof record.code === "number" ? record.code : null;
  const className =
  error instanceof Error
    ? error.name
    : typeof record.name === "string"
      ? record.name
      : "Error";

const raw =
  error instanceof Error
    ? error.message
    : typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : "Storage write failed.";

const message = redactStorageMessage(raw);
const combined = `${code ?? ""} ${message}`.toLowerCase();
  if (/invalid_grant|invalid credential|could not load the default credentials|credentials are not configured/.test(combined)) {
    return { reason: "credential", code, className, message, bucket };
  }
  if (code === 403 || code === 401 || /forbidden|permission|access denied|unauthorized/.test(combined)) {
    return { reason: "permission", code, className, message, bucket };
  }
  if (code === 404 || /bucket does not exist|not found|no such bucket/.test(combined)) {
    return { reason: "bucket-not-found", code, className, message, bucket };
  }
  return { reason: "object-write", code, className, message, bucket };
}

export function ownerPhotoStorageUserMessage(failure: ClassifiedStorageFailure) {
  if (failure.reason === "bucket-not-found") {
    return "The Firebase Storage bucket was not found. Enable Storage in this Firebase project, or confirm the default bucket name.";
  }
  if (failure.reason === "permission") {
    return "This service account cannot write to Firebase Storage.";
  }
  if (failure.reason === "credential") {
    return "Firebase Admin credentials were rejected for Storage.";
  }
  return "Unable to save that photo. Please try again.";
}
