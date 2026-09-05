import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  businessPublications, businessPublicationVersions, projectBusinessDna,
  projectOutputs, projectPreviewCustomizations, projectPublicContacts, projects, publishedWebsites,
} from "@/app/db/schema";
import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { buildBusinessPreview } from "@/app/lib/business-preview";
import { applyPreviewOverrides, validatePreviewOverrides } from "@/app/lib/business-preview-edits";
import { buildPublishedBusinessSnapshot, businessPreviewRevision, normalizeBusinessSlug } from "@/app/lib/business-publication";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { hasPaidProductAccess, requirePaidProductAccess } from "@/app/lib/paid-entitlements";

const MAX_BODY_BYTES = 1_024;

function metadata(site: typeof businessPublications.$inferSelect | undefined) {
  if (!site) return { status: "unpublished" as const };
  return {
    status: site.status,
    slug: site.publicSlug,
    publishedPreviewRevision: site.publishedPreviewRevision,
    publishedAt: site.publishedAt,
    publicUrl: `/business/${site.publicSlug}`,
  };
}

async function userId(request: Request) {
  try { return (await verifyFirebaseIdToken(request)).uid; } catch { return null; }
}

async function bodyProjectId(request: Request) {
  try {
    const body = await readLimitedJson(request, MAX_BODY_BYTES);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, "projectId")) return null;
    return validateEasyModeProjectId((body as { projectId?: unknown }).projectId);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError || error instanceof MalformedJsonBodyError) return null;
    throw error;
  }
}

function failure(error: unknown, action: string) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "NOT_FOUND") return Response.json({ error: "Project not found." }, { status: 404 });
  if (message === "PREVIEW_NOT_APPROVED") return Response.json({ error: "Approve the current preview before publishing." }, { status: 409 });
  if (message === "NO_PREVIEW") return Response.json({ error: "No completed business preview is available." }, { status: 409 });
  if (message === "WEBSITE_LIMIT_REACHED") return Response.json({ error: "Your plan includes one active website. Unpublish the current website before publishing another." }, { status: 429 });
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code.slice(0, 32) : "UNKNOWN";
  console.error("Business publication request failed.", { action, code });
  return Response.json({ error: `Unable to ${action} this business.` }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const uid = await userId(request);
    if (!uid) return Response.json({ error: "Authentication is required." }, { status: 401 });
    const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
    if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
    const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1);
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const canPublish = await hasPaidProductAccess(uid);
    const [sites, customizations] = await Promise.all([
      db.select().from(businessPublications).where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, uid))).limit(1),
      db.select().from(projectPreviewCustomizations).where(and(eq(projectPreviewCustomizations.projectId, projectId), eq(projectPreviewCustomizations.userId, uid))).limit(1),
    ]);
    const site = sites[0];
    const customization = customizations[0];
    const changesAwaitingApproval = Boolean(site && customization && Object.keys(customization.overrides).length > 0 && !customization.approvedAt);
    const publication = metadata(site);
    return Response.json({ publication: { ...publication, ...(!canPublish && { publicUrl: undefined }), changesAwaitingApproval, canPublish } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "load publication status for"); }
}

export async function POST(request: Request) {
  const uid = await userId(request);
  if (!uid) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const entitlement = await requirePaidProductAccess(uid); if (!entitlement.ok) return entitlement.response;
  const projectId = await bodyProjectId(request);
  if (!projectId) return Response.json({ error: "Invalid publication request." }, { status: 400 });
  try {
    const site = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`business-publication:${projectId}`}))`);
      const [project] = await transaction.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1).for("update");
      if (!project) throw new Error("NOT_FOUND");
      const [otherActive] = await transaction.select({ id: publishedWebsites.id }).from(publishedWebsites)
        .where(and(eq(publishedWebsites.ownerUid, uid), eq(publishedWebsites.status, "active"))).limit(1);
      if (otherActive) throw new Error("WEBSITE_LIMIT_REACHED");
      const [dnaRows, outputRows, customRows, contactRows] = await Promise.all([
        transaction.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, uid), eq(projectBusinessDna.confirmed, true))).limit(1),
        transaction.select().from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
        transaction.select().from(projectPreviewCustomizations).where(and(eq(projectPreviewCustomizations.projectId, projectId), eq(projectPreviewCustomizations.userId, uid))).limit(1),
        transaction.select().from(projectPublicContacts).where(and(eq(projectPublicContacts.projectId, projectId), eq(projectPublicContacts.userId, uid))).limit(1),
      ]);
      if (!dnaRows[0]) throw new Error("NO_PREVIEW");
      const latest = selectLatestWorkspaceOutputs(outputRows);
      const original = buildBusinessPreview({ project: workspaceProjectPresentation(project, dnaRows[0].dna), outputs: latest });
      if (original.approval.outputIds.length === 0) throw new Error("NO_PREVIEW");
      const checked = validatePreviewOverrides(customRows[0]?.overrides ?? {}, original);
      const overrides = checked.valid ? checked.overrides : {};
      const hasOverrides = Object.keys(overrides).length > 0;
      const approved = hasOverrides ? Boolean(customRows[0]?.approvedAt) : original.approval.approved;
      if (!approved) throw new Error("PREVIEW_NOT_APPROVED");
      const revision = businessPreviewRevision(original.approval.outputIds, (customRows[0]?.revisionCount ?? 0) + (contactRows[0]?.revisionCount ?? 0), { overrides, contact: contactRows[0]?.settings ?? {} });
      const preview = applyPreviewOverrides(original, overrides);
      const snapshot = buildPublishedBusinessSnapshot(preview, contactRows[0]?.settings ?? {});
      const [existing] = await transaction.select().from(businessPublications).where(eq(businessPublications.projectId, projectId)).limit(1);
      if (existing?.status === "active" && existing.publishedPreviewRevision === revision) return existing;
      const now = new Date();
      if (existing) {
        const nextVersion = existing.currentVersion + 1;
        await transaction.insert(businessPublicationVersions).values({ publicationId: existing.id, versionNumber: nextVersion, previewRevision: revision, snapshot });
        const [updated] = await transaction.update(businessPublications).set({ status: "active", publishedPreviewRevision: revision, currentVersion: nextVersion, publishedAt: now, unpublishedAt: null, updatedAt: now }).where(and(eq(businessPublications.id, existing.id), eq(businessPublications.userId, uid))).returning();
        return updated;
      }
      const base = normalizeBusinessSlug(preview.business.name);
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`business-slug:${base}`}))`);
      let slug: string | null = null;
      for (let attempt = 1; attempt <= 999; attempt += 1) {
        const ending = attempt === 1 ? "" : `-${attempt}`;
        const candidate = `${base.slice(0, 63 - ending.length).replace(/-$/g, "")}${ending}`;
        const [collision] = await transaction.select({ id: businessPublications.id }).from(businessPublications).where(eq(businessPublications.publicSlug, candidate)).limit(1);
        if (!collision) { slug = candidate; break; }
      }
      if (!slug) throw new Error("SLUGS_EXHAUSTED");
      const [created] = await transaction.insert(businessPublications).values({ projectId, userId: uid, publicSlug: slug, status: "active", publishedPreviewRevision: revision, currentVersion: 1, publishedAt: now, updatedAt: now }).returning();
      await transaction.insert(businessPublicationVersions).values({ publicationId: created.id, versionNumber: 1, previewRevision: revision, snapshot });
      return created;
    });
    return Response.json({ publication: metadata(site) });
  } catch (error) { return failure(error, "publish"); }
}

export async function DELETE(request: Request) {
  const uid = await userId(request);
  if (!uid) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const projectId = await bodyProjectId(request);
  if (!projectId) return Response.json({ error: "Invalid publication request." }, { status: 400 });
  try {
    const [site] = await db.update(businessPublications).set({ status: "inactive", unpublishedAt: new Date(), updatedAt: new Date() }).where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, uid))).returning();
    if (!site) throw new Error("NOT_FOUND");
    return Response.json({ publication: metadata(site) });
  } catch (error) { return failure(error, "unpublish"); }
}
