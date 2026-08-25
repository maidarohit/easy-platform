import { db } from "@/app/db";
import { aiManagerJobs } from "@/app/db/schema";
import { completeAiUsage, failAiUsage } from "@/app/lib/ai-usage";
import type { AiManagerOutput, AiManagerStrategy } from "@/app/lib/ai/types";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { syncEasyModeAiManagerTask } from "@/app/lib/easy-mode-ai-manager";
import { getModuleAdapter } from "@/app/lib/easy-mode-execution-contracts";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import { and, eq, inArray } from "drizzle-orm";

const strategyKeys: Array<keyof AiManagerStrategy> = [
  "overview",
  "branding",
  "website",
  "marketing",
  "seo",
  "uiux",
  "sales",
  "analytics",
];

const MAX_CALLBACK_BODY_BYTES = 256 * 1024;
const MAX_JOB_ID_LENGTH = 128;
const MAX_ERROR_LENGTH = 2_000;
const MAX_STRATEGY_SECTION_BYTES = 25 * 1024;

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

type ValidCallbackBody =
  | { jobId: string; status: "completed"; output: AiManagerStrategy }
  | { jobId: string; status: "failed"; error?: string };

export function validateAiManagerCallbackBody(
  value: unknown,
  expectedJobId: string
): ValidCallbackBody | null {
  if (!expectedJobId || expectedJobId.length > MAX_JOB_ID_LENGTH) return null;
  if (!isRecord(value)) return null;

  const jobId = text(value.jobId);
  if (jobId !== expectedJobId || jobId.length > MAX_JOB_ID_LENGTH) return null;

  if (value.status === "failed") {
    if (Object.keys(value).some((key) => !["jobId", "status", "error"].includes(key))) {
      return null;
    }
    if (value.error !== undefined && typeof value.error !== "string") return null;
    const error = value.error === undefined ? undefined : value.error.trim();
    if (error && error.length > MAX_ERROR_LENGTH) return null;
    return { jobId, status: "failed", ...(error ? { error } : {}) };
  }

  if (value.status !== "completed") return null;
  if (Object.keys(value).some((key) => !["jobId", "status", "output"].includes(key))) {
    return null;
  }
  const output = value.output;
  if (!isRecord(output)) return null;
  if (
    Object.keys(output).length !== strategyKeys.length ||
    Object.keys(output).some((key) => !strategyKeys.includes(key as keyof AiManagerStrategy))
  ) {
    return null;
  }
  for (const key of strategyKeys) {
    const section = output[key];
    if (
      typeof section !== "string" ||
      Buffer.byteLength(section, "utf8") > MAX_STRATEGY_SECTION_BYTES
    ) {
      return null;
    }
  }
  const validatedOutput = getModuleAdapter("ai-manager")?.validateOutput?.(output);
  if (!validatedOutput) return null;
  return { jobId, status: "completed", output: validatedOutput as unknown as AiManagerStrategy };
}

type JobRouteContext = { params: Promise<{ jobId: string }> };
type TerminalStatus = "completed" | "failed";

async function finalizeUsage(
  usageId: string | null,
  status: TerminalStatus,
  createdAt: Date
) {
  if (!usageId) return;

  try {
    const durationMs = Math.max(0, Date.now() - createdAt.getTime());

    if (status === "completed") {
      await completeAiUsage({ usageId, durationMs });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
  } catch {
    console.error("AI Manager usage finalization failed.");
  }
}

export async function GET(request: Request, { params }: JobRouteContext) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { jobId } = await params;
  const [job] = await db
    .select()
    .from(aiManagerJobs)
    .where(and(eq(aiManagerJobs.id, jobId), eq(aiManagerJobs.userId, userId)))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  const response: Record<string, unknown> = { jobId: job.id, status: job.status };

  if (job.status === "completed" && job.result) {
    response.result = JSON.parse(job.result) as AiManagerOutput;
  }

  if (job.status === "failed") {
    response.error = job.error || "AI Manager job failed.";
  }

  return Response.json(response);
}

export async function POST(request: Request, { params }: JobRouteContext) {
  const configuredSecret = text(process.env.AI_MANAGER_CALLBACK_SECRET);
  const suppliedSecret = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized callback." }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId || jobId.length > MAX_JOB_ID_LENGTH) {
    return Response.json({ error: "Invalid callback body." }, { status: 400 });
  }

  let parsedBody: unknown;

  try {
    parsedBody = await readLimitedJson(request, MAX_CALLBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    if (!(error instanceof MalformedJsonBodyError)) throw error;
    return Response.json({ error: "Invalid callback body." }, { status: 400 });
  }

  const body = validateAiManagerCallbackBody(parsedBody, jobId);
  if (!body) return Response.json({ error: "Invalid callback body." }, { status: 400 });

  const [job] = await db
    .select()
    .from(aiManagerJobs)
    .where(eq(aiManagerJobs.id, jobId))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed") {
    await syncEasyModeAiManagerTask(jobId);
    return Response.json({ jobId, status: job.status });
  }

  const outputIsValid = body.status === "completed";
  const nextStatus: TerminalStatus = body.status;
  const error = body.status === "failed"
    ? body.error || "AI Manager workflow failed."
    : null;

  const [transitionedJob] = await db
    .update(aiManagerJobs)
    .set(
      nextStatus === "completed" && outputIsValid
        ? {
            status: "completed",
            result: JSON.stringify({ output: body.output }),
            error: null,
            updatedAt: new Date(),
          }
        : {
            status: "failed",
            result: null,
            error,
            updatedAt: new Date(),
          }
    )
    .where(
      and(
        eq(aiManagerJobs.id, jobId),
        inArray(aiManagerJobs.status, ["pending", "processing"])
      )
    )
    .returning({
      usageId: aiManagerJobs.usageId,
      createdAt: aiManagerJobs.createdAt,
      status: aiManagerJobs.status,
    });

  if (!transitionedJob) {
    const [terminalJob] = await db
      .select({ status: aiManagerJobs.status })
      .from(aiManagerJobs)
      .where(eq(aiManagerJobs.id, jobId))
      .limit(1);

    return Response.json({ jobId, status: terminalJob?.status || job.status });
  }

  await finalizeUsage(
    transitionedJob.usageId,
    transitionedJob.status as TerminalStatus,
    transitionedJob.createdAt
  );
  await syncEasyModeAiManagerTask(jobId);

  return Response.json({ jobId, status: nextStatus });
}
