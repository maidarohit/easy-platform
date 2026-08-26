import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readLimitedJson } from "@/app/lib/request-body";
import { SOCIAL_PROVIDERS } from "@/app/lib/social-provider";
import { createSocialOAuthState } from "@/app/lib/social-oauth-state";

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
  try { createSocialOAuthState({ uid, projectId, provider: provider as "meta" | "linkedin" }); }
  catch { return Response.json({ error: "Social publishing setup is not connected yet." }, { status: 503 }); }
  return Response.json({ error: "REAL CONNECTION DEFERRED UNTIL SECURE TOKEN STORAGE / PROVIDER CONFIG." }, { status: 503 });
}
