import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdTokenAllowUnverified } from "@/app/lib/firebase-admin";

export async function requireOwnedStoreProject(request: Request, projectId: string) {
  let userId: string | null = null;
  try {
    userId = (await verifyFirebaseIdTokenAllowUnverified(request)).uid;
  } catch {
    userId = null;
  }
  if (!userId) {
    return { error: "Authentication is required.", status: 401 as const, userId: null, projectId: "" };
  }
  if (!projectId) {
    return { error: "projectId is required.", status: 400 as const, userId: null, projectId: "" };
  }
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) {
    return { error: "Project not found.", status: 404 as const, userId: null, projectId: "" };
  }
  return { error: null, status: 200 as const, userId, projectId };
}
