import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  readBusinessDnaForOwner,
  updateBusinessDnaForOwner,
} from "@/app/lib/business-dna-store";
import { validateBusinessDnaPatch, type BusinessDnaContent } from "@/app/lib/business-dna";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_PROJECT_ID_LENGTH = 128;

type Dependencies = Readonly<{
  verify: typeof verifyFirebaseIdToken;
  read: typeof readBusinessDnaForOwner;
  update: typeof updateBusinessDnaForOwner;
}>;

const dependencies: Dependencies = {
  verify: verifyFirebaseIdToken,
  read: readBusinessDnaForOwner,
  update: updateBusinessDnaForOwner,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function projectIdFromUrl(request: Request) {
  const value = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  return value && value.length <= MAX_PROJECT_ID_LENGTH ? value : null;
}

export async function handleBusinessDnaGet(request: Request, deps: Dependencies = dependencies) {
  let userId: string;
  try {
    userId = (await deps.verify(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  const projectId = projectIdFromUrl(request);
  if (!projectId) return Response.json({ error: "projectId is required." }, { status: 400 });
  try {
    const dna = await deps.read(userId, projectId);
    if (dna === undefined) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ success: true, dna }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Business DNA read failed.");
    return Response.json({ error: "Failed to load Business DNA." }, { status: 500 });
  }
}

export async function handleBusinessDnaPatch(request: Request, deps: Dependencies = dependencies) {
  let userId: string;
  try {
    userId = (await deps.verify(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let value: unknown;
  try {
    value = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Business DNA request is too large." }, { status: 413 });
    }
    if (error instanceof MalformedJsonBodyError) {
      return Response.json({ error: "Invalid Business DNA request." }, { status: 400 });
    }
    throw error;
  }
  if (!isPlainObject(value) || Object.keys(value).some((key) => !["projectId", "dna", "confirmed"].includes(key)) ||
      typeof value.projectId !== "string" || !value.projectId.trim() || value.projectId.trim().length > MAX_PROJECT_ID_LENGTH ||
      (value.confirmed !== undefined && typeof value.confirmed !== "boolean")) {
    return Response.json({ error: "Invalid Business DNA request." }, { status: 400 });
  }
  const patch = validateBusinessDnaPatch(value.dna ?? {});
  if (!patch) return Response.json({ error: "Invalid Business DNA request." }, { status: 400 });

  try {
    const dna = await deps.update({
      userId,
      projectId: value.projectId.trim(),
      patch: patch as BusinessDnaContent,
      confirmed: value.confirmed as boolean | undefined,
    });
    if (dna === undefined) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ success: true, dna }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Business DNA update failed.");
    return Response.json({ error: "Failed to save Business DNA." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleBusinessDnaGet(request);
}

export async function PATCH(request: Request) {
  return handleBusinessDnaPatch(request);
}
