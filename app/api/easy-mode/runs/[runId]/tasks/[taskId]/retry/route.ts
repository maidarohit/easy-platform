import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTaskAttempts, easyModeTasks, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  canExplicitlyRetryAttempt,
  EasyModeAttemptError,
  prepareEasyModeTaskRetry,
} from "@/app/lib/easy-mode-task-attempts";
import { validateEasyModeRunId } from "@/app/lib/easy-mode-run-validation";
import { MalformedJsonBodyError, readOptionalLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_BODY_BYTES = 1024;
type RouteContext = { params: Promise<{ runId: string; taskId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  try {
    const body = await readOptionalLimitedJson(request, MAX_BODY_BYTES);
    if (body !== undefined &&
        (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0)) {
      return Response.json({ error: "Invalid retry request." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid retry request." }, { status: 400 });
    throw error;
  }

  const routeParams = await params;
  const runId = validateEasyModeRunId(routeParams.runId);
  const taskId = validateEasyModeRunId(routeParams.taskId);
  if (!runId || !taskId) return Response.json({ error: "Invalid retry request." }, { status: 400 });

  const [ownedTask] = await db.select({
    id: easyModeTasks.id,
    projectId: easyModeRuns.projectId,
  }).from(easyModeTasks).innerJoin(easyModeRuns, eq(easyModeTasks.runId, easyModeRuns.id)).where(and(
    eq(easyModeTasks.id, taskId),
    eq(easyModeTasks.runId, runId),
    eq(easyModeRuns.userId, userId),
  )).limit(1);
  if (!ownedTask) return Response.json({ error: "Business step not found." }, { status: 404 });
  const [ownedProject] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, ownedTask.projectId),
    eq(projects.userId, userId),
  )).limit(1);
  if (!ownedProject) return Response.json({ error: "Business step not found." }, { status: 404 });

  const [attempt] = await db.select({
    id: easyModeTaskAttempts.id,
    status: easyModeTaskAttempts.status,
  }).from(easyModeTaskAttempts).where(and(
    eq(easyModeTaskAttempts.taskId, taskId),
    eq(easyModeTaskAttempts.runId, runId),
    eq(easyModeTaskAttempts.userId, userId),
    eq(easyModeTaskAttempts.projectId, ownedTask.projectId),
  )).orderBy(desc(easyModeTaskAttempts.attemptNumber)).limit(1);
  if (!attempt || !canExplicitlyRetryAttempt(attempt.status)) {
    return Response.json({ error: "This step cannot be retried safely." }, { status: 409 });
  }

  try {
    await prepareEasyModeTaskRetry({ attemptId: attempt.id, userId });
  } catch (error) {
    if (error instanceof EasyModeAttemptError && error.code === "RETRY_NOT_ALLOWED") {
      return Response.json({ error: "This step is already being handled." }, { status: 409 });
    }
    throw error;
  }
  return Response.json({ state: "ready", message: "This step is ready to try again." }, {
    headers: { "Cache-Control": "no-store" },
  });
}
