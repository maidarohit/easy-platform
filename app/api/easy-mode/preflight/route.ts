import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { resolveEasyModePlan } from "@/app/lib/easy-mode-plans";
import { isEasyModeGoalId } from "@/app/lib/easy-mode-goal-options";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { easyModeQuotaError, preflightEasyModePlanQuota } from "@/app/lib/easy-mode-quota-preflight";

const MAX_BODY_BYTES = 4 * 1024;

function validatePreflightBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["projectId", "industry", "goalId"].includes(key))) return null;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const industry = typeof body.industry === "string" ? body.industry.trim() : "";
  if (!projectId || projectId.length > 128 || !industry || industry.length > 200 || !isEasyModeGoalId(body.goalId)) return null;
  return { projectId, industry, goalId: body.goalId };
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid request." }, { status: 400 });
    throw error;
  }

  const body = validatePreflightBody(parsed);
  const plan = body && resolveEasyModePlan(body.goalId);
  if (!body || !plan) return Response.json({ error: "Choose a valid business goal." }, { status: 400 });

  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const quotaPreflight = await preflightEasyModePlanQuota(userId, plan);
  if (!quotaPreflight.ok) return easyModeQuotaError(quotaPreflight);

  await db.update(projects).set({ industry: body.industry, goal: body.goalId, updatedAt: new Date() })
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)));

  return Response.json({ status: "ready", message: "Ready to build", plannedSteps: plan.length });
}
