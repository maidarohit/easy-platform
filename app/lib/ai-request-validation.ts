import "server-only";

import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";

export const AI_REQUEST_BODY_LIMIT_BYTES = 16 * 1024;

const MAX_ID_LENGTH = 128;
const MAX_SHORT_LENGTH = 200;
const MAX_LONG_LENGTH = 4_000;
const MAX_NESTED_BYTES = 12 * 1024;
const MAX_NESTED_DEPTH = 8;
const MAX_NESTED_ENTRIES = 100;

type Schema = {
  short: readonly string[];
  long: readonly string[];
  optionalShort?: readonly string[];
  optionalLong?: readonly string[];
  projectContext?: boolean;
  optionalNested?: readonly string[];
};

const schemas = {
  analytics: {
    short: ["companyName", "industry", "monthlyVisitors", "monthlyLeads", "monthlySales", "monthlyRevenue", "marketingBudget", "businessGoal"],
    long: ["businessDescription"],
    optionalNested: ["salesContext"],
  },
  branding: {
    short: ["companyName", "industry", "targetAudience", "brandStyle"],
    long: ["brandDescription"],
  },
  website: {
    short: ["companyName", "industry", "targetAudience", "brandStyle"],
    long: ["brandDescription"],
  },
  marketing: {
    short: ["companyName", "industry", "targetAudience", "brandStyle"],
    long: ["brandDescription"],
    optionalShort: ["regenerateSection", "mode"],
    optionalLong: ["editInstruction"],
    optionalNested: ["currentResult"],
  },
  seo: {
    short: ["companyName", "industry", "targetAudience", "brandStyle"],
    long: ["brandDescription"],
  },
  uiux: {
    short: ["companyName", "industry", "targetAudience", "brandStyle"],
    long: ["brandDescription"],
  },
  sales: {
    short: ["companyName", "industry", "salesGoal", "targetAudience"],
    long: ["businessDescription"],
  },
  content: {
    short: ["contentType", "tone", "audience", "length", "keywords"],
    long: ["prompt"],
  },
  presentation: {
    short: ["presentationType", "audience", "tone", "slideCount", "designStyle"],
    long: ["topic", "keyPoints"],
    projectContext: true,
  },
  logo: {
    short: ["companyName", "industry", "brandStyle"],
    long: ["logoIdea"],
  },
  image: {
    short: ["style", "size"],
    long: ["prompt"],
    projectContext: true,
  },
  video: {
    short: ["style", "duration", "videoType", "cameraMovement", "lighting", "colorPalette", "aspectRatio"],
    long: ["prompt", "scene", "importantDetails", "negativePrompt"],
    projectContext: true,
  },
  "automation-content": {
    short: ["businessName", "contentType", "targetAudience", "tone"],
    long: ["topic", "instructions"],
    projectContext: true,
  },
  "automation-email": {
    short: ["businessName", "targetAudience", "tone"],
    long: ["topic", "instructions"],
    projectContext: true,
  },
  "automation-social": {
    short: ["businessName", "targetAudience", "platform", "postType", "tone"],
    long: ["topic", "instructions"],
    projectContext: true,
  },
  "automation-workflow": {
    short: ["workflowName", "trigger"],
    long: ["automationGoal", "workflowSteps", "additionalInstructions"],
    projectContext: true,
  },
  "automation-pipeline": {
    short: ["businessName"],
    long: ["pipelineGoal", "capabilities", "instructions"],
    projectContext: true,
  },
} as const satisfies Record<string, Schema>;

export type AiRequestSchemaName = keyof typeof schemas;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

function isBoundedNestedJson(value: unknown, depth = 0): boolean {
  if (depth > MAX_NESTED_DEPTH) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") return value.length <= MAX_LONG_LENGTH;
  if (Array.isArray(value)) {
    return value.length <= MAX_NESTED_ENTRIES && value.every((item) => isBoundedNestedJson(item, depth + 1));
  }
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= MAX_NESTED_ENTRIES && entries.every(
    ([key, item]) => key.length <= MAX_SHORT_LENGTH && isBoundedNestedJson(item, depth + 1),
  );
}

function boundedNestedJson(value: unknown): boolean {
  if (!isBoundedNestedJson(value)) return false;
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_NESTED_BYTES;
  } catch {
    return false;
  }
}

function validProjectContext(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isPlainObject(value)) return false;
  const shortFields = new Set(["companyName", "industry", "targetAudience", "goal", "brandStyle"]);
  const allowed = new Set([...shortFields, "businessDescription"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return Object.entries(value).every(([key, item]) =>
    typeof item === "string" && item.length <= (shortFields.has(key) ? MAX_SHORT_LENGTH : MAX_LONG_LENGTH)
  );
}

export function validateAiRequestBody(
  schemaName: AiRequestSchemaName,
  value: unknown,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  const schema: Schema = schemas[schemaName];
  const allowed = new Set([
    "projectId",
    ...schema.short,
    ...schema.long,
    ...(schema.optionalShort ?? []),
    ...(schema.optionalLong ?? []),
    ...(schema.optionalNested ?? []),
    ...(schema.projectContext ? ["projectContext"] : []),
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return null;

  if (typeof value.projectId !== "string") return null;
  const projectId = value.projectId.trim();
  if (!projectId || projectId.length > MAX_ID_LENGTH) return null;

  const validated: Record<string, unknown> = { projectId };
  for (const field of schema.short) {
    const item = value[field];
    if (typeof item !== "string" || item.length > MAX_SHORT_LENGTH) return null;
    validated[field] = item;
  }
  for (const field of schema.long) {
    const item = value[field];
    if (typeof item !== "string" || item.length > MAX_LONG_LENGTH) return null;
    validated[field] = item;
  }
  for (const field of schema.optionalShort ?? []) {
    const item = value[field];
    if (item === undefined) continue;
    if (typeof item !== "string" || item.length > MAX_SHORT_LENGTH) return null;
    validated[field] = item;
  }
  for (const field of schema.optionalLong ?? []) {
    const item = value[field];
    if (item === undefined) continue;
    if (typeof item !== "string" || item.length > MAX_LONG_LENGTH) return null;
    validated[field] = item;
  }
  for (const field of schema.optionalNested ?? []) {
    const item = value[field];
    if (item === undefined) continue;
    if (!boundedNestedJson(item)) return null;
    validated[field] = item;
  }
  if (schema.projectContext) {
    if (!validProjectContext(value.projectContext)) return null;
    if (value.projectContext !== undefined) validated.projectContext = value.projectContext;
  }
  return validated;
}

export async function readValidatedAiRequest(
  request: Request,
  schemaName: AiRequestSchemaName,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  let parsedBody: unknown;
  try {
    parsedBody = await readLimitedJson(request, AI_REQUEST_BODY_LIMIT_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { ok: false, response: Response.json({ error: "Request body is too large." }, { status: 413 }) };
    }
    if (!(error instanceof MalformedJsonBodyError)) throw error;
    return { ok: false, response: Response.json({ error: "Invalid request body." }, { status: 400 }) };
  }

  const body = validateAiRequestBody(schemaName, parsedBody);
  if (!body) {
    return { ok: false, response: Response.json({ error: "Invalid request body." }, { status: 400 }) };
  }
  return { ok: true, body };
}
