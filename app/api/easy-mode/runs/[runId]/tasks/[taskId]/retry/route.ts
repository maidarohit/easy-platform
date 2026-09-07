import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTaskAttempts, easyModeTasks, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  canExplicitlyRetryAttempt,
  EasyModeAttemptError,
  prepareEasyModeTaskRetry,
  prepareUncertainEasyModeTaskRetry,
  reconcileUncertainEasyModeAttempt,
} from "@/app/lib/easy-mode-task-attempts";
import { executeEasyModeRun } from "@/app/lib/easy-mode-executor";
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
    status: easyModeTasks.status,
    projectOutputId: easyModeTasks.projectOutputId,
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
  if (!attempt) {
    return Response.json({ error: "This step cannot be retried safely." }, { status: 409 });
  }

  try {
    if (attempt.status === "failed_uncertain") {
      const reconciliation = await reconcileUncertainEasyModeAttempt({ attemptId: attempt.id, userId });
      if (reconciliation.state !== "completed") {
        if (ownedTask.status !== "failed" || ownedTask.projectOutputId !== null) {
          return Response.json({ error: "This step cannot be retried safely." }, { status: 409 });
        }
        await prepareUncertainEasyModeTaskRetry({ attemptId: attempt.id, userId });
      }
    } else if (canExplicitlyRetryAttempt(attempt.status)) {
      await prepareEasyModeTaskRetry({ attemptId: attempt.id, userId });
    } else {
      return Response.json({ error: "This step cannot be retried safely." }, { status: 409 });
    }
  } catch (error) {
    if (error instanceof EasyModeAttemptError && error.code === "RETRY_NOT_ALLOWED") {
      return Response.json({ error: "This step is already being handled." }, { status: 409 });
    }
    throw error;
  }
  const result = await executeEasyModeRun({ runId, userId });
  const status = result.state === "needs_attention" ? 422 : 200;
  return Response.json({ ...result, recovery: attempt.status === "failed_uncertain" ? "explicit_uncertain" : "safe_retry" }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
