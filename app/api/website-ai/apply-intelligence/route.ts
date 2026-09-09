import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projects, socialDailyPosts } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { applyLatestWebsiteIntelligence } from "@/app/lib/website-intelligence-connection";

const MAX_BODY_BYTES = 1_024;
const SOURCE_MODULES = ["website", "branding", "uiux", "seo", "marketing", "sales", "content"] as const;

function projectIdBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 || !("projectId" in value)) return null;
  const projectId = (value as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.trim() && projectId.trim().length <= 128 ? projectId.trim() : null;
}

function parsed(result: string) {
  try { return JSON.parse(result); } catch { return null; }
}

export async function PATCH(request: Request) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }

  let projectId: string | null;
  try { projectId = projectIdBody(await readLimitedJson(request, MAX_BODY_BYTES)); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid request." }, { status: 400 });
    throw error;
  }
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });

  try {
    const output = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-intelligence:${userId}:${projectId}`}))`);
      const [project] = await transaction.select().from(projects).where(and(
        eq(projects.id, projectId), eq(projects.userId, userId),
      )).limit(1).for("update");
      if (!project) throw new Error("NOT_FOUND");
      const [rows, dnaRows, socialRows] = await Promise.all([
        transaction.select().from(projectOutputs).where(and(
          eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
          inArray(projectOutputs.module, [...SOURCE_MODULES]),
        )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
        transaction.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
          eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, userId), eq(projectBusinessDna.confirmed, true),
        )).limit(1),
        transaction.select({ originalContent: socialDailyPosts.originalContent, editedContent: socialDailyPosts.editedContent,
          recommendedAction: socialDailyPosts.recommendedAction }).from(socialDailyPosts).where(and(
          eq(socialDailyPosts.projectId, projectId), eq(socialDailyPosts.userId, userId),
          or(eq(socialDailyPosts.status, "approved"), eq(socialDailyPosts.status, "published")),
        )).orderBy(desc(socialDailyPosts.updatedAt)).limit(20),
      ]);
      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) if (!latest.has(row.module)) latest.set(row.module, row);
      const website = latest.get("website");
      if (!website) throw new Error("NO_WEBSITE_DRAFT");
      const approved = (module: string) => {
        const row = latest.get(module);
        return row?.approvedAt ? parsed(row.result) : null;
      };
      const merged = applyLatestWebsiteIntelligence({
        project,
        website: parsed(website.result),
        businessDna: dnaRows[0]?.dna ?? null,
        branding: parsed(latest.get("branding")?.result ?? ""),
        uiux: parsed(latest.get("uiux")?.result ?? ""),
        approvedSeo: approved("seo"),
        approvedMarketing: approved("marketing"),
        approvedSales: approved("sales"),
        approvedContent: approved("content"),
        approvedSocial: socialRows.map((post) => ({
          content: post.editedContent?.trim() || post.originalContent,
          recommendedAction: post.recommendedAction,
        })),
      });
      if (!merged) throw new Error("INVALID_MERGE");
      if (!merged.changed) return merged;
      const [updated] = await transaction.update(projectOutputs).set({
        result: JSON.stringify(merged.output), approvedAt: null, updatedAt: new Date(),
      }).where(and(
        eq(projectOutputs.id, website.id), eq(projectOutputs.projectId, projectId),
        eq(projectOutputs.userId, userId), eq(projectOutputs.module, "website"),
      )).returning();
      if (!updated) throw new Error("UPDATE_FAILED");
      return merged;
    });
    return Response.json(output, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "Project not found." }, { status: 404 });
    if (error instanceof Error && error.message === "NO_WEBSITE_DRAFT") return Response.json({ error: "Generate a website draft before applying business intelligence." }, { status: 409 });
    console.error("Website intelligence update failed.");
    return Response.json({ error: "Unable to update the website draft." }, { status: 500 });
  }
}
