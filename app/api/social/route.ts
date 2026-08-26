import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import { projectBusinessDna, projectOutputs, projects, socialConnections, socialDailyPosts } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { recommendationFromSavedData, selectLatestSavedMarketing, SOCIAL_MARKETING_MODULES, socialLocalDate, validateEditedContent } from "@/app/lib/social-content";
import { SOCIAL_PROVIDERS, socialProviderSetup } from "@/app/lib/social-provider";

const MAX_BODY_BYTES = 8 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function owner(request: Request, projectId: string) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; } catch { return { response: Response.json({ error: "Authentication is required." }, { status: 401 }) } as const; }
  if (!uuidPattern.test(projectId)) return { response: Response.json({ error: "A valid projectId is required." }, { status: 400 }) } as const;
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return project ? { userId, projectId } as const : { response: Response.json({ error: "Project not found." }, { status: 404 }) } as const;
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  try {
    const access = await owner(request, projectId);
    if ("response" in access) return access.response;
    const [[dna], marketingRows, connections] = await Promise.all([
      db.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, access.userId), eq(projectBusinessDna.confirmed, true))).limit(1),
      db.select({ module: projectOutputs.module, result: projectOutputs.result }).from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, access.userId), inArray(projectOutputs.module, [...SOCIAL_MARKETING_MODULES]))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
      db.select().from(socialConnections).where(and(eq(socialConnections.projectId, projectId), eq(socialConnections.userId, access.userId))),
    ]);
    const recommendation = recommendationFromSavedData(selectLatestSavedMarketing(marketingRows), dna?.dna as Record<string, unknown> | null);
    const localDate = socialLocalDate();
    if (recommendation) {
      await db.insert(socialDailyPosts).values({ projectId, userId: access.userId, localDate, sourceHash: recommendation.sourceHash, originalContent: recommendation.content, theme: recommendation.theme, recommendedAction: "Review and approve before publishing." }).onConflictDoNothing({ target: [socialDailyPosts.projectId, socialDailyPosts.localDate] });
    }
    let [dailyPost] = await db.select().from(socialDailyPosts).where(and(eq(socialDailyPosts.projectId, projectId), eq(socialDailyPosts.userId, access.userId), eq(socialDailyPosts.localDate, localDate))).limit(1);
    if (dailyPost && recommendation && dailyPost.status === "proposed" && !dailyPost.originalContent.trim() && !dailyPost.editedContent?.trim()) {
      [dailyPost] = await db.update(socialDailyPosts).set({ sourceHash: recommendation.sourceHash, originalContent: recommendation.content, theme: recommendation.theme, recommendedAction: "Review and approve before publishing.", updatedAt: new Date() }).where(and(eq(socialDailyPosts.id, dailyPost.id), eq(socialDailyPosts.userId, access.userId), eq(socialDailyPosts.status, "proposed"))).returning();
    }
    return Response.json({
      timezone: "UTC", localDate,
      channels: SOCIAL_PROVIDERS.map((provider) => connections.find((item) => item.provider === provider) ?? socialProviderSetup(provider)),
      recommendation: dailyPost ? { id: dailyPost.id, content: dailyPost.editedContent ?? dailyPost.originalContent, originalContent: dailyPost.originalContent, platform: dailyPost.platform, theme: dailyPost.theme, recommendedAction: dailyPost.recommendedAction, status: dailyPost.status } : null,
      publishingAvailable: connections.some((item) => item.status === "connected"),
    });
  } catch {
    return Response.json({ error: "Social & Content is unavailable until its secure database setup is complete." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request body is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request." }, { status: 400 });
  const value = body as Record<string, unknown>;
  const action = value.action;
  const allowedKeys = action === "edit" ? ["projectId", "action", "content"] : ["projectId", "action"];
  if (!allowedKeys.includes("projectId") || Object.keys(value).some((key) => !allowedKeys.includes(key)) || typeof value.projectId !== "string" || !["edit", "approve", "skip", "reset", "publish"].includes(String(action))) return Response.json({ error: "Invalid social update." }, { status: 400 });
  try {
    const access = await owner(request, value.projectId);
    if ("response" in access) return access.response;
    const localDate = socialLocalDate();
    const [current] = await db.select().from(socialDailyPosts).where(and(eq(socialDailyPosts.projectId, access.projectId), eq(socialDailyPosts.userId, access.userId), eq(socialDailyPosts.localDate, localDate))).limit(1);
    if (!current) return Response.json({ error: "No recommendation is available today." }, { status: 409 });
    if (action === "publish") return Response.json({ error: "Social publishing setup is not connected yet." }, { status: 409 });
    const updates = action === "edit" ? { editedContent: validateEditedContent(value.content), status: "proposed" as const }
      : action === "approve" ? { status: "approved" as const }
      : action === "skip" ? { status: "skipped" as const }
      : { editedContent: null, status: "proposed" as const };
    if (action === "edit" && !updates.editedContent) return Response.json({ error: "Post text must be plain text between 1 and 2,200 characters." }, { status: 400 });
    await db.update(socialDailyPosts).set({ ...updates, updatedAt: new Date() }).where(and(eq(socialDailyPosts.id, current.id), eq(socialDailyPosts.userId, access.userId)));
    return Response.json({ status: updates.status, content: "editedContent" in updates ? updates.editedContent ?? current.originalContent : current.editedContent ?? current.originalContent });
  } catch { return Response.json({ error: "Unable to update today's recommendation." }, { status: 503 }); }
}
