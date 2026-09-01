import { and, desc, eq, sql } from "drizzle-orm";

import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projectPreviewCustomizations, projects } from "@/app/db/schema";
import { applyPreviewOverrides } from "@/app/lib/business-preview-edits";
import { buildBusinessPreview } from "@/app/lib/business-preview";
import { ownerVideoIncomingObjectPath, runBusinessVideoFinalize } from "@/app/lib/business-owner-video";
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
  if (Object.keys(record).some((key) => !["projectId", "objectPath", "contentType"].includes(key))) {
    return Response.json({ error: "Invalid video upload request." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId(record.projectId);
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });

  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, projectId),
    eq(projects.userId, userId),
  )).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const [customization] = await db.select().from(projectPreviewCustomizations).where(and(
    eq(projectPreviewCustomizations.projectId, projectId),
    eq(projectPreviewCustomizations.userId, userId),
  )).limit(1);

  const result = await runBusinessVideoFinalize({
    userId,
    projectId,
    projectOwnerId: project.userId,
    objectPath: typeof record.objectPath === "string" ? record.objectPath : ownerVideoIncomingObjectPath(userId, projectId),
    declaredMime: typeof record.contentType === "string" ? record.contentType : null,
    previousOverrides: customization?.overrides ?? {},
    storage: firebaseBusinessVideoStorage,
    persistOverrides: async (overrides) => {
      const now = new Date();
      await db.insert(projectPreviewCustomizations).values({
        projectId,
        userId,
        overrides,
        approvedAt: null,
        revisionCount: 1,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: projectPreviewCustomizations.projectId,
        set: {
          overrides,
          approvedAt: null,
          revisionCount: sql`${projectPreviewCustomizations.revisionCount} + 1`,
          updatedAt: now,
        },
      });
      return overrides;
    },
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  const [dnaRow, outputs] = await Promise.all([
    db.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
      eq(projectBusinessDna.projectId, projectId),
      eq(projectBusinessDna.userId, userId),
      eq(projectBusinessDna.confirmed, true),
    )).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
  ]);
  const originalPreview = buildBusinessPreview({
    project: workspaceProjectPresentation(project, dnaRow?.dna ?? null),
    outputs: selectLatestWorkspaceOutputs(outputs),
  });
  const preview = applyPreviewOverrides(originalPreview, result.overrides);
  preview.approval.approved = false;
  return Response.json({
    businessVideo: result.businessVideo,
    overrides: result.overrides,
    preview,
  }, { headers: { "Cache-Control": "no-store" } });
}
