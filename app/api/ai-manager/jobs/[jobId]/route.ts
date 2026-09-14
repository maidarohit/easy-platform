import { db } from "@/app/db";
import { aiManagerJobs } from "@/app/db/schema";
import { completeAiUsage, failAiUsage } from "@/app/lib/ai-usage";
import type { AiManagerOutput, AiManagerStrategy } from "@/app/lib/ai/types";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { syncEasyModeAiManagerTask } from "@/app/lib/easy-mode-ai-manager";
import { getModuleAdapter } from "@/app/lib/easy-mode-execution-contracts";
import { scheduleEasyModeRunDispatcher } from "@/app/lib/easy-mode-run-dispatcher";
import {
  SpecialistCallbackError,
  syncEasyModeSpecialistCallback,
  type ValidSpecialistCallbackBody,
  validateSpecialistCallbackBody,
} from "@/app/lib/easy-mode-specialist-callbacks";
import { validateWrappedWebhookOutput } from "@/app/lib/specialist-execution";
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
const BRANDING_SPECIALIST_METADATA_KEYS = [
  "attemptId",
  "executionKey",
  "runId",
  "taskId",
  "projectId",
  "module",
  "status",
  "providerExecutionId",
  "usage",
  "jobId",
] as const;

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
type BrandingSpecialistCallbackBody =
  ValidSpecialistCallbackBody & Readonly<{ module: "branding" }>;
type ValidJobsCallbackBody =
  | Readonly<{ kind: "ai-manager"; body: ValidCallbackBody }>
  | Readonly<{
    kind: "branding-specialist";
    body: BrandingSpecialistCallbackBody;
  }>;

function validateAiManagerStrategyCandidate(value: unknown): AiManagerStrategy | null {
  const validatedOutput = getModuleAdapter("ai-manager")?.validateOutput?.(value);
  if (!validatedOutput || !isRecord(validatedOutput)) return null;

  const sections: Partial<Record<keyof AiManagerStrategy, string>> = {};
  for (const key of strategyKeys) {
    if (typeof validatedOutput[key] !== "string") return null;
    sections[key] = validatedOutput[key] as string;
  }

  return {
    overview: sections.overview!,
    branding: sections.branding!,
    website: sections.website!,
    marketing: sections.marketing!,
    seo: sections.seo!,
    uiux: sections.uiux!,
    sales: sections.sales!,
    analytics: sections.analytics!,
  };
}

export function validateAiManagerCallbackBody(
  value: unknown,
  expectedJobId: string
): ValidCallbackBody | null {
  if (!expectedJobId || expectedJobId.length > MAX_JOB_ID_LENGTH) return null;
  if (!isRecord(value)) return null;

  const jobId = text(value.jobId);
  if (jobId !== expectedJobId || jobId.length > MAX_JOB_ID_LENGTH) return null;
  const normalizedStatus = text(value.status).toLowerCase() === "success"
    ? "completed"
    : text(value.status).toLowerCase();

  if (normalizedStatus === "failed") {
    if (value.error !== undefined && typeof value.error !== "string") return null;
    const error = value.error === undefined ? undefined : value.error.trim();
    if (error && error.length > MAX_ERROR_LENGTH) return null;
    return { jobId, status: "failed", ...(error ? { error } : {}) };
  }

  if (normalizedStatus !== "completed") return null;
  const wrappedOutput = validateWrappedWebhookOutput(
    value,
    (candidate) => getModuleAdapter("ai-manager")?.validateOutput?.(candidate) ?? null,
  );
  const output = validateAiManagerStrategyCandidate(wrappedOutput);
  if (!output) return null;
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
  return { jobId, status: "completed", output };
}

function validateBrandingSpecialistJobsCallbackBody(
  value: unknown,
  expectedAttemptId: string,
): BrandingSpecialistCallbackBody | null {
  if (!isRecord(value)) return null;

  const candidate = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "jobId"),
  );
  const validated = validateSpecialistCallbackBody(candidate, expectedAttemptId);
  if (validated?.module === "branding") return validated as BrandingSpecialistCallbackBody;

  const wrapperKeys = ["output", "result", "response", "data", "body", "json", "text"];
  if (wrapperKeys.some((key) => Object.hasOwn(candidate, key))) return null;

  const metadataKeys = new Set<string>(BRANDING_SPECIALIST_METADATA_KEYS);
  const metadata = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => metadataKeys.has(key)),
  );
  const payload = Object.fromEntries(
    Object.entries(candidate).filter(([key]) => !metadataKeys.has(key)),
  );
  if (Object.keys(payload).length === 0) return null;

  const wrapped = validateSpecialistCallbackBody({
    ...metadata,
    output: payload,
  }, expectedAttemptId);
  return wrapped?.module === "branding" ? wrapped as BrandingSpecialistCallbackBody : null;
}

export function validateAiManagerJobsCallbackBody(
  value: unknown,
  expectedId: string,
): ValidJobsCallbackBody | null {
  const brandingSpecialist = validateBrandingSpecialistJobsCallbackBody(value, expectedId);
  if (brandingSpecialist) {
    return Object.freeze({ kind: "branding-specialist", body: brandingSpecialist });
  }

  const aiManager = validateAiManagerCallbackBody(value, expectedId);
  return aiManager ? Object.freeze({ kind: "ai-manager", body: aiManager }) : null;
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

  const body = validateAiManagerJobsCallbackBody(parsedBody, jobId);
  if (!body) return Response.json({ error: "Invalid callback body." }, { status: 400 });

  if (body.kind === "branding-specialist") {
    try {
      const result = await syncEasyModeSpecialistCallback(jobId, body.body);
      const continuation = result.continuation;
      scheduleEasyModeRunDispatcher(continuation ? { requestedRunId: continuation.runId, userId: continuation.userId } : {});
      return Response.json({
        attemptId: jobId,
        module: body.body.module,
        status: result.state === "ignored" ? "ignored" : body.body.status,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof SpecialistCallbackError) {
        return Response.json({ error: error.message }, { status: error.httpStatus });
      }
      throw error;
    }
  }

  const [job] = await db
    .select()
    .from(aiManagerJobs)
    .where(eq(aiManagerJobs.id, jobId))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed") {
    const continuation = await syncEasyModeAiManagerTask(jobId);
    scheduleEasyModeRunDispatcher(continuation ? { requestedRunId: continuation.runId, userId: continuation.userId } : {});
    return Response.json({ jobId, status: job.status });
  }

  const outputIsValid = body.body.status === "completed";
  const nextStatus: TerminalStatus = body.body.status;
  const error = body.body.status === "failed"
    ? body.body.error || "AI Manager workflow failed."
    : null;

  const [transitionedJob] = await db
    .update(aiManagerJobs)
    .set(
      nextStatus === "completed" && outputIsValid
        ? {
            status: "completed",
            result: JSON.stringify({ output: body.body.output }),
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
  const continuation = await syncEasyModeAiManagerTask(jobId);

  scheduleEasyModeRunDispatcher(nextStatus === "completed" && continuation
    ? { requestedRunId: continuation.runId, userId: continuation.userId }
    : {});

  return Response.json({ jobId, status: nextStatus });
}
