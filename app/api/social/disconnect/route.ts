import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects, socialConnections } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readLimitedJson } from "@/app/lib/request-body";
import { SOCIAL_PROVIDERS } from "@/app/lib/social-provider";

export async function POST(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; } catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  let body: unknown;
  try { body = await readLimitedJson(request, 2048); } catch { return Response.json({ error: "Invalid disconnect request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid disconnect request." }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof value.projectId !== "string" || !SOCIAL_PROVIDERS.includes(value.provider as never)) return Response.json({ error: "Invalid disconnect request." }, { status: 400 });
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, value.projectId), eq(projects.userId, uid))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  await db.delete(socialConnections).where(and(eq(socialConnections.projectId, value.projectId), eq(socialConnections.userId, uid), eq(socialConnections.provider, value.provider as "meta" | "linkedin")));
  return Response.json({ disconnected: true });
}
