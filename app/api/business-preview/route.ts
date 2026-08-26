import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projectPreviewCustomizations, projects } from "@/app/db/schema";
import {
  selectLatestWorkspaceOutputs,
  workspaceProjectPresentation,
} from "@/app/api/master-workspace/route";
import { BUSINESS_PREVIEW_MODULES, buildBusinessPreview } from "@/app/lib/business-preview";
import { applyPreviewOverrides, validatePreviewOverrides } from "@/app/lib/business-preview-edits";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_BODY_BYTES = 1024;

async function authenticatedUser(request: Request) {
  try { return (await verifyFirebaseIdToken(request)).uid; } catch { return null; }
}

async function ownedProject(userId: string, projectId: string) {
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, projectId), eq(projects.userId, userId),
  )).limit(1);
  return project ?? null;
}

export async function GET(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const project = await ownedProject(userId, projectId);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const [dnaRow, outputs, customization] = await Promise.all([
    db.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
      eq(projectBusinessDna.projectId, projectId),
      eq(projectBusinessDna.userId, userId),
      eq(projectBusinessDna.confirmed, true),
    )).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
    db.select().from(projectPreviewCustomizations).where(and(
      eq(projectPreviewCustomizations.projectId, projectId),
      eq(projectPreviewCustomizations.userId, userId),
    )).limit(1).then((rows) => rows[0] ?? null),
  ]);
  const latest = selectLatestWorkspaceOutputs(outputs);
  const originalPreview = buildBusinessPreview({
    project: workspaceProjectPresentation(project, dnaRow?.dna ?? null),
    outputs: latest,
  });
  const checked = validatePreviewOverrides(customization?.overrides ?? {}, originalPreview);
  const overrides = checked.valid ? checked.overrides : {};
  const preview = applyPreviewOverrides(originalPreview, overrides);
  preview.approval.approved = Object.keys(overrides).length > 0
    ? Boolean(customization?.approvedAt)
    : originalPreview.approval.approved;
  return Response.json({ preview, originalPreview, overrides }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const userId = await authenticatedUser(request);
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid request." }, { status: 400 });
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, "projectId")) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId((body as { projectId?: unknown }).projectId);
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });

  const result = await db.transaction(async (transaction) => {
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, projectId), eq(projects.userId, userId),
    )).limit(1).for("update");
    if (!project) return { error: "Project not found.", status: 404 as const };
    const rows = await transaction.select().from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt));
    const latest = selectLatestWorkspaceOutputs(rows);
    const [customization] = await transaction.select().from(projectPreviewCustomizations).where(and(
      eq(projectPreviewCustomizations.projectId, projectId),
      eq(projectPreviewCustomizations.userId, userId),
    )).limit(1);
    const outputIds = BUSINESS_PREVIEW_MODULES
      .map((module) => latest.get(module)?.id)
      .filter((id): id is string => Boolean(id));
    if (outputIds.length === 0) return { error: "No saved preview is ready for approval.", status: 409 as const };
    const approvedAt = new Date();
    if (customization && Object.keys(customization.overrides).length > 0) {
      await transaction.update(projectPreviewCustomizations).set({ approvedAt, updatedAt: approvedAt }).where(and(
        eq(projectPreviewCustomizations.projectId, projectId),
        eq(projectPreviewCustomizations.userId, userId),
      ));
      return { approvedAt, outputIds };
    }
    await transaction.update(projectOutputs).set({ approvedAt }).where(and(
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
      inArray(projectOutputs.id, outputIds),
      isNull(projectOutputs.approvedAt),
    ));
    return { approvedAt, outputIds };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({
    approved: true,
    approvedAt: result.approvedAt.toISOString(),
    outputCount: result.outputIds.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
