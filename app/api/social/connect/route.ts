import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readLimitedJson } from "@/app/lib/request-body";
import { SOCIAL_PROVIDERS } from "@/app/lib/social-provider";
import { createSocialOAuthState } from "@/app/lib/social-oauth-state";
import { MetaOAuthError, metaAuthorizationUrl } from "@/app/lib/meta-oauth";

export async function POST(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; } catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  let body: unknown;
  try { body = await readLimitedJson(request, 2048); } catch { return Response.json({ error: "Invalid connection request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["projectId", "provider"].includes(key))) return Response.json({ error: "Invalid connection request." }, { status: 400 });
  const { projectId, provider } = body as Record<string, unknown>;
  if (typeof projectId !== "string" || !SOCIAL_PROVIDERS.includes(provider as never)) return Response.json({ error: "Invalid connection request." }, { status: 400 });
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  if (provider !== "meta") return Response.json({ error: "LinkedIn connection is not available yet." }, { status: 503 });
  try {
    const state = createSocialOAuthState({ uid, projectId, provider: "meta" });
    return Response.json({ authorizationUrl: metaAuthorizationUrl(state) });
  } catch (error) {
    console.error("Meta OAuth initialization failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: error instanceof MetaOAuthError ? error.publicMessage : "Meta connection is not configured." }, { status: 503 });
  }
}
