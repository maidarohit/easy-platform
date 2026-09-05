import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projectPreviewCustomizations, projects } from "@/app/db/schema";
import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { buildBusinessPreview } from "@/app/lib/business-preview";
import { applyPreviewOverrides, validatePreviewOverrides } from "@/app/lib/business-preview-edits";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { completeAiUsage, startAiUsage } from "@/app/lib/ai-usage";

const MAX_BODY_BYTES = 16_384;

export async function PUT(request: Request) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }

  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "These preview changes are too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid preview changes." }, { status: 400 });
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "projectId" && key !== "overrides") ||
      !Object.hasOwn(body, "projectId") || !Object.hasOwn(body, "overrides")) {
    return Response.json({ error: "Invalid preview changes." }, { status: 400 });
  }
  const projectId = validateEasyModeProjectId((body as { projectId?: unknown }).projectId);
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });

  const [ownedProject] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!ownedProject) return Response.json({ error: "Project not found." }, { status: 404 });
  let usageId: string;
  try {
    usageId = await startAiUsage({ userId, projectId, module: "website-edit", workflow: "business-preview-edit" });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const result = await db.transaction(async (transaction) => {
    const [project] = await transaction.select().from(projects).where(and(
      eq(projects.id, projectId), eq(projects.userId, userId),
    )).limit(1).for("update");
    if (!project) return { error: "Project not found.", status: 404 as const };
    const [dnaRows, outputs] = await Promise.all([
      transaction.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
        eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, userId),
        eq(projectBusinessDna.confirmed, true),
      )).limit(1),
      transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
      )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
    ]);
    const originalPreview = buildBusinessPreview({
      project: workspaceProjectPresentation(project, dnaRows[0]?.dna ?? null),
      outputs: selectLatestWorkspaceOutputs(outputs),
    });
    const checked = validatePreviewOverrides((body as { overrides: unknown }).overrides, originalPreview);
    if (!checked.valid) return { error: checked.error, status: 400 as const };
    const now = new Date();
    await transaction.insert(projectPreviewCustomizations).values({
      projectId, userId, overrides: checked.overrides, approvedAt: null,
      revisionCount: 1, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: projectPreviewCustomizations.projectId,
      set: {
        overrides: checked.overrides,
        approvedAt: null,
        revisionCount: sql`${projectPreviewCustomizations.revisionCount} + 1`,
        updatedAt: now,
      },
    });
    const preview = applyPreviewOverrides(originalPreview, checked.overrides);
    preview.approval.approved = false;
    return { preview, overrides: checked.overrides };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  await completeAiUsage({ usageId, durationMs: 0 });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
