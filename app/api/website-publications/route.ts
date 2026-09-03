import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  projectOutputs,
  projects,
  projectPreviewCustomizations,
  publishedWebsites,
  websitePublicationVersions,
} from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { requirePaidProductAccess } from "@/app/lib/paid-entitlements";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import {
  buildWebsitePublicationSnapshot,
  suggestWebsiteSlug,
  validatePublicationMutationBody,
  validateWebsiteEdits,
} from "@/app/lib/website-publication";

const MAX_BODY_BYTES = 16 * 1024;

function publicUrl(slug: string) {
  return {
    internalUrl: `/published-sites/${slug}`,
    futureUrl: `https://sites.buzypeezy.ai/${slug}`,
  };
}

function safeMetadata(site: typeof publishedWebsites.$inferSelect | undefined) {
  if (!site) return { status: "unpublished" as const };
  return {
    status: site.status,
    slug: site.slug,
    currentVersion: site.currentVersion,
    lastPublishedAt: site.lastPublishedAt,
    ...publicUrl(site.slug),
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function authorizeProject(request: Request, projectId: string) {
  let uid: string;
  try {
    uid = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return { response: Response.json({ error: "Authentication is required." }, { status: 401 }) } as const;
  }
  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1);
  if (!project) return { response: Response.json({ error: "Project not found." }, { status: 404 }) } as const;
  return { uid, project } as const;
}

async function readBody(request: Request, action: "publish" | "republish" | "unpublish") {
  try {
    const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
    const body = validatePublicationMutationBody(parsed, action);
    return body
      ? { body } as const
      : { response: Response.json({ error: "Invalid publication request." }, { status: 400 }) } as const;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { response: Response.json({ error: "Request body is too large." }, { status: 413 }) } as const;
    }
    if (error instanceof MalformedJsonBodyError) {
      return { response: Response.json({ error: "Invalid JSON body." }, { status: 400 }) } as const;
    }
    throw error;
  }
}

function parseStoredOutput(result: string): unknown {
  try { return JSON.parse(result); } catch { return null; }
}

function storedWebsiteEdits(result: string) {
  const output = parseStoredOutput(result);
  return output && typeof output === "object" && !Array.isArray(output) && "websiteEdits" in output
    ? output.websiteEdits
    : undefined;
}

function snapshotFor(
  project: typeof projects.$inferSelect,
  template: string,
  outputResult: string,
  overrides?: unknown,
) {
  const websiteEdits = validateWebsiteEdits(storedWebsiteEdits(outputResult));
  return buildWebsitePublicationSnapshot({
    companyName: websiteEdits?.companyName || project.companyName || project.name,
    industry: project.industry || "Business",
    websiteGoal: project.goal || project.targetAudience || "",
    websiteRequirements: project.brandDescription || project.originalBrief || "",
    template: websiteEdits?.template || template,
    websiteOutput: parseStoredOutput(outputResult),
    ...(websiteEdits && { websiteEdits }),
    media: overrides && typeof overrides === "object" && !Array.isArray(overrides) ? {
      hero: (overrides as Record<string, unknown>).heroImage,
    } : undefined,
  });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId || projectId.length > 128) return Response.json({ error: "Invalid project." }, { status: 400 });
  const authorized = await authorizeProject(request, projectId);
  if ("response" in authorized) return authorized.response;
  const [site] = await db.select().from(publishedWebsites)
    .where(and(eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, authorized.uid))).limit(1);
  return Response.json({ publication: safeMetadata(site), suggestedSlug: suggestWebsiteSlug(authorized.project.companyName || authorized.project.name) });
}

export async function POST(request: Request) {
  const parsed = await readBody(request, "publish");
  if ("response" in parsed) return parsed.response;
  const authorized = await authorizeProject(request, parsed.body.projectId);
  if ("response" in authorized) return authorized.response;
  const entitlement = await requirePaidProductAccess(authorized.uid); if (!entitlement.ok) return entitlement.response;

  try {
    const site = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-slug:${parsed.body.slug}`}))`);
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-project:${parsed.body.projectId}`}))`);
      const [existing] = await transaction.select({ id: publishedWebsites.id }).from(publishedWebsites)
        .where(eq(publishedWebsites.projectId, parsed.body.projectId)).limit(1);
      if (existing) throw new Error("PUBLICATION_EXISTS");
      const [output] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.projectId, parsed.body.projectId),
        eq(projectOutputs.userId, authorized.uid),
        eq(projectOutputs.module, "website"),
      )).orderBy(desc(projectOutputs.updatedAt)).limit(1);
      const [customization] = await transaction.select({ overrides: projectPreviewCustomizations.overrides }).from(projectPreviewCustomizations).where(and(
        eq(projectPreviewCustomizations.projectId, parsed.body.projectId), eq(projectPreviewCustomizations.userId, authorized.uid),
      )).limit(1);
      const snapshot = output && snapshotFor(authorized.project, parsed.body.template!, output.result, customization?.overrides);
      if (!snapshot) throw new Error("INVALID_WEBSITE_OUTPUT");
      const now = new Date();
      const [created] = await transaction.insert(publishedWebsites).values({
        ownerUid: authorized.uid,
        projectId: parsed.body.projectId,
        slug: parsed.body.slug!,
        template: parsed.body.template!,
        currentVersion: 1,
        status: "active",
        firstPublishedAt: now,
        lastPublishedAt: now,
      }).returning();
      await transaction.insert(websitePublicationVersions).values({
        publishedWebsiteId: created.id,
        versionNumber: 1,
        action: "publish",
        snapshot,
      });
      return created;
    });
    return Response.json({ publication: safeMetadata(site) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ error: "That website address is already in use." }, { status: 409 });
    if (error instanceof Error && error.message === "PUBLICATION_EXISTS") return Response.json({ error: "This project already has a website publication." }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_WEBSITE_OUTPUT") return Response.json({ error: "Generate a valid Website AI draft before publishing." }, { status: 400 });
    console.error("Website publication failed.");
    return Response.json({ error: "Unable to publish the website." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const parsed = await readBody(request, "republish");
  if ("response" in parsed) return parsed.response;
  const authorized = await authorizeProject(request, parsed.body.projectId);
  if ("response" in authorized) return authorized.response;
  const entitlement = await requirePaidProductAccess(authorized.uid); if (!entitlement.ok) return entitlement.response;
  try {
    const site = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-project:${parsed.body.projectId}`}))`);
      const [current] = await transaction.select().from(publishedWebsites).where(and(
        eq(publishedWebsites.projectId, parsed.body.projectId), eq(publishedWebsites.ownerUid, authorized.uid),
      )).limit(1);
      if (!current) throw new Error("NOT_FOUND");
      const [output] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.projectId, parsed.body.projectId), eq(projectOutputs.userId, authorized.uid), eq(projectOutputs.module, "website"),
      )).orderBy(desc(projectOutputs.updatedAt)).limit(1);
      const [customization] = await transaction.select({ overrides: projectPreviewCustomizations.overrides }).from(projectPreviewCustomizations).where(and(
        eq(projectPreviewCustomizations.projectId, parsed.body.projectId), eq(projectPreviewCustomizations.userId, authorized.uid),
      )).limit(1);
      const snapshot = output && snapshotFor(authorized.project, current.template, output.result, customization?.overrides);
      if (!snapshot) throw new Error("INVALID_WEBSITE_OUTPUT");
      const nextVersion = current.currentVersion + 1;
      await transaction.insert(websitePublicationVersions).values({ publishedWebsiteId: current.id, versionNumber: nextVersion, action: "republish", snapshot });
      const [updated] = await transaction.update(publishedWebsites).set({ currentVersion: nextVersion, status: "active", lastPublishedAt: new Date(), unpublishedAt: null, updatedAt: new Date() }).where(eq(publishedWebsites.id, current.id)).returning();
      return updated;
    });
    return Response.json({ publication: safeMetadata(site) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "Publication not found." }, { status: 404 });
    if (error instanceof Error && error.message === "INVALID_WEBSITE_OUTPUT") return Response.json({ error: "The Website AI draft is not valid for publication." }, { status: 400 });
    console.error("Website republication failed.");
    return Response.json({ error: "Unable to republish the website." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const parsed = await readBody(request, "unpublish");
  if ("response" in parsed) return parsed.response;
  const authorized = await authorizeProject(request, parsed.body.projectId);
  if ("response" in authorized) return authorized.response;
  try {
    const site = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-project:${parsed.body.projectId}`}))`);
      const [current] = await transaction.select().from(publishedWebsites).where(and(
        eq(publishedWebsites.projectId, parsed.body.projectId), eq(publishedWebsites.ownerUid, authorized.uid),
      )).limit(1);
      if (!current) throw new Error("NOT_FOUND");
      const [liveVersion] = await transaction.select().from(websitePublicationVersions).where(and(
        eq(websitePublicationVersions.publishedWebsiteId, current.id), eq(websitePublicationVersions.versionNumber, current.currentVersion),
      )).limit(1);
      if (!liveVersion) throw new Error("VERSION_NOT_FOUND");
      const nextVersion = current.currentVersion + 1;
      await transaction.insert(websitePublicationVersions).values({ publishedWebsiteId: current.id, versionNumber: nextVersion, action: "unpublish", snapshot: liveVersion.snapshot });
      const [updated] = await transaction.update(publishedWebsites).set({ currentVersion: nextVersion, status: "inactive", unpublishedAt: new Date(), updatedAt: new Date() }).where(eq(publishedWebsites.id, current.id)).returning();
      return updated;
    });
    return Response.json({ publication: safeMetadata(site) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "Publication not found." }, { status: 404 });
    console.error("Website unpublish failed.");
    return Response.json({ error: "Unable to unpublish the website." }, { status: 500 });
  }
}
