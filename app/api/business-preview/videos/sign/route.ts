import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { runBusinessVideoSign } from "@/app/lib/business-owner-video";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { firebaseBusinessVideoStorage } from "@/app/lib/firebase-admin-storage";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_BODY_BYTES = 1024;

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid video upload request." }, { status: 400 });
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid video upload request." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["projectId", "contentType", "byteSize"].includes(key))) {
    return Response.json({ error: "Invalid video upload request." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId(record.projectId);
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });


const [project] = await db
  .select({ id: projects.id, userId: projects.userId })
  .from(projects)
  .where(
    and(
      eq(projects.id, projectId),
      eq(projects.userId, userId),
    ),
  )
  .limit(1);


const result = await runBusinessVideoSign({
  userId,
  projectId,
  projectOwnerId: project?.userId ?? null,
  declaredMime:
    typeof record.contentType === "string" ? record.contentType : null,
  byteSize:
    typeof record.byteSize === "number" ? record.byteSize : Number.NaN,
  storage: firebaseBusinessVideoStorage,
});

  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({
    uploadUrl: result.uploadUrl,
    objectPath: result.objectPath,
    contentType: result.contentType,
    requiredHeaders: result.requiredHeaders,
    maxBytes: result.maxBytes,
    expiresAt: result.expiresAt,
  }, { headers: { "Cache-Control": "no-store" } });
}
