import "server-only";

import { parseSupportedLanguageCode } from "@/app/lib/supported-languages";

const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 200;
const MAX_SHORT_LENGTH = 200;
const MAX_LONG_LENGTH = 4_000;
const MAX_PROJECT_RESULT_LENGTH = 28 * 1024;
const MAX_RESULT_BYTES = 250 * 1024;
const MAX_RESULT_DEPTH = 12;
const MAX_RESULT_ENTRIES = 200;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

function optionalBoundedString(
  value: unknown,
  maxLength: number,
): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

const projectShortFields = [
  "companyName",
  "industry",
  "targetAudience",
  "location",
  "businessStage",
  "brandStyle",
] as const;
const projectLongFields = [
  "goal",
  "mainGoal",
  "originalBrief",
  "businessDescription",
  "brandDescription",
] as const;

export function validateProjectMutationBody(
  value: unknown,
): Record<string, string> | null {
  if (!isPlainObject(value)) return null;
  const allowed = new Set([
    "id",
    "userId",
    "name",
    "creationIntent",
    "primaryLanguage",
    ...projectShortFields,
    ...projectLongFields,
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;

  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  const id = value.id.trim();
  const name = value.name.trim();
  if (!id || id.length > MAX_ID_LENGTH || !name || name.length > MAX_NAME_LENGTH) {
    return null;
  }
  if (!optionalBoundedString(value.userId, MAX_ID_LENGTH)) return null;
  if (value.creationIntent !== undefined && value.creationIntent !== "new-business") return null;
  if (value.primaryLanguage !== undefined && !parseSupportedLanguageCode(value.primaryLanguage)) return null;
  for (const field of projectShortFields) {
    if (!optionalBoundedString(value[field], MAX_SHORT_LENGTH)) return null;
  }
  for (const field of projectLongFields) {
    if (!optionalBoundedString(value[field], MAX_LONG_LENGTH)) return null;
  }
  if (!optionalBoundedString(value.result, MAX_PROJECT_RESULT_LENGTH)) return null;

  const validated: Record<string, string> = { id, name };
  if (value.creationIntent === "new-business") validated.creationIntent = value.creationIntent;
  if (typeof value.primaryLanguage === "string") validated.primaryLanguage = value.primaryLanguage;
  for (const field of [...projectShortFields, ...projectLongFields]) {
    const item = value[field];
    if (typeof item === "string") validated[field] = item;
  }
  if (typeof value.result === "string") validated.result = value.result;
  return validated;
}

const memoryShortFields = [
  "businessName",
  "industry",
  "targetAudience",
  "brandStyle",
  "brandVoice",
  "brandColors",
  "typography",
] as const;
const memoryLongFields = [
  "businessDescription",
  "websiteGoal",
  "marketingGoal",
  "additionalContext",
] as const;

export function validateProjectMemoryBody(
  value: unknown,
): Record<string, string> | null {
  if (!isPlainObject(value)) return null;
  const allowed = new Set(["projectId", ...memoryShortFields, ...memoryLongFields]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;
  if (typeof value.projectId !== "string") return null;
  const projectId = value.projectId.trim();
  if (!projectId || projectId.length > MAX_ID_LENGTH) return null;
  for (const field of memoryShortFields) {
    if (!optionalBoundedString(value[field], MAX_SHORT_LENGTH)) return null;
  }
  for (const field of memoryLongFields) {
    if (!optionalBoundedString(value[field], MAX_LONG_LENGTH)) return null;
  }

  const validated: Record<string, string> = { projectId };
  for (const field of [...memoryShortFields, ...memoryLongFields]) {
    const item = value[field];
    if (typeof item === "string") validated[field] = item;
  }
  return validated;
}

function isBoundedJson(value: unknown, depth = 0): boolean {
  if (depth > MAX_RESULT_DEPTH) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") return true;
  if (Array.isArray(value)) {
    return value.length <= MAX_RESULT_ENTRIES && value.every((item) => isBoundedJson(item, depth + 1));
  }
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_RESULT_ENTRIES && entries.every(
    ([key, item]) => key.length <= MAX_NAME_LENGTH && isBoundedJson(item, depth + 1),
  );
}

type ProjectOutputBody = {
  projectId: string;
  module: string;
  result: string;
};

export function validateProjectOutputBody(value: unknown): ProjectOutputBody | null {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).some((key) => !["projectId", "module", "result"].includes(key))) {
    return null;
  }
  if (typeof value.projectId !== "string" || typeof value.module !== "string") {
    return null;
  }
  const projectId = value.projectId.trim();
  const moduleName = value.module.trim().toLowerCase();
  if (!projectId || projectId.length > MAX_ID_LENGTH) return null;
  if (!moduleName || moduleName.length > 100) return null;
  if (value.result === undefined || value.result === null || !isBoundedJson(value.result)) {
    return null;
  }

  let result: string;
  try {
    result = typeof value.result === "string"
      ? value.result.trim()
      : JSON.stringify(value.result);
  } catch {
    return null;
  }
  if (!result || Buffer.byteLength(result, "utf8") > MAX_RESULT_BYTES) return null;
  return { projectId, module: moduleName, result };
}
