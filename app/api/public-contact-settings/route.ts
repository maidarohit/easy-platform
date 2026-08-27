import { and, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { projectPublicContacts, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { validatePublicContactSettings } from "@/app/lib/public-contact";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

async function owner(request: Request) { try { return (await verifyFirebaseIdToken(request)).uid; } catch { return null; } }
export async function GET(request: Request) {
  const userId = await owner(request); if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const [row] = await db.select({ settings: projectPublicContacts.settings }).from(projectPublicContacts).where(and(eq(projectPublicContacts.projectId, projectId), eq(projectPublicContacts.userId, userId))).limit(1);
  return Response.json({ settings: row?.settings ?? {}, inquiryFormAvailable: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: Request) {
  const userId = await owner(request); if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  let body: unknown;
  try { body = await readLimitedJson(request, 8_192); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Contact settings are too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid contact settings." }, { status: 400 });
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid contact settings." }, { status: 400 });
  const record = body as Record<string, unknown>; const projectId = validateEasyModeProjectId(record.projectId); const checked = validatePublicContactSettings(record.settings);
  if (!projectId || Object.keys(record).some((key) => key !== "projectId" && key !== "settings") || !checked.valid) return Response.json({ error: checked.valid ? "Invalid project." : checked.error }, { status: 400 });
  const result = await db.transaction(async (transaction) => {
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1).for("update");
    if (!project) return null;
    const now = new Date();
    await transaction.insert(projectPublicContacts).values({ projectId, userId, settings: checked.settings, revisionCount: 1, createdAt: now, updatedAt: now }).onConflictDoUpdate({
      target: projectPublicContacts.projectId, set: { settings: checked.settings, revisionCount: sql`${projectPublicContacts.revisionCount} + 1`, updatedAt: now },
    });
    return checked.settings;
  });
  return result ? Response.json({ settings: result, inquiryFormAvailable: true }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Project not found." }, { status: 404 });
}
