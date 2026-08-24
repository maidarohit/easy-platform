import { db } from "@/app/db";
import { aiManagerJobs, projectMemory, projects } from "@/app/db/schema";
import { failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import {
  getN8nWebhookConfig,
  n8nConfigurationErrorResponse,
} from "@/app/lib/n8n-webhooks";
import { and, eq, inArray } from "drizzle-orm";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MAX_ID_LENGTH = 128;
const MAX_SHORT_FIELD_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_ANALYTICS_CONTEXT_BYTES = 16 * 1024;
const MAX_CONTEXT_DEPTH = 8;
const MAX_CONTEXT_ENTRIES = 100;

type AiManagerRequestBody = {
  projectId: string;
  companyName: string;
  businessDescription: string;
  industry: string;
  businessGoal: string;
  analyticsContext: unknown;
};

function isBoundedJson(value: unknown, depth = 0): boolean {
  if (depth > MAX_CONTEXT_DEPTH) return false;
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === "string") return value.length <= MAX_DESCRIPTION_LENGTH;
  if (Array.isArray(value)) {
    return (
      value.length <= MAX_CONTEXT_ENTRIES &&
      value.every((item) => isBoundedJson(item, depth + 1))
    );
  }
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_CONTEXT_ENTRIES &&
    entries.every(
      ([key, item]) =>
        key.length <= MAX_SHORT_FIELD_LENGTH &&
        isBoundedJson(item, depth + 1)
    )
  );
}

export function validateAiManagerRequestBody(
  value: unknown
): AiManagerRequestBody | null {
  if (!isRecord(value)) return null;

  const expectedKeys = new Set([
    "projectId",
    "companyName",
    "businessDescription",
    "industry",
    "businessGoal",
    "analyticsContext",
  ]);
  if (Object.keys(value).some((key) => !expectedKeys.has(key))) return null;

  const projectId = text(value.projectId);
  const companyName = text(value.companyName);
  const businessDescription = text(value.businessDescription);
  const industry = text(value.industry);
  const businessGoal = text(value.businessGoal);
  if (!projectId || projectId.length > MAX_ID_LENGTH) return null;
  if (!companyName || companyName.length > MAX_SHORT_FIELD_LENGTH) return null;
  if (!industry || industry.length > MAX_SHORT_FIELD_LENGTH) return null;
  if (!businessDescription || businessDescription.length > MAX_DESCRIPTION_LENGTH) {
    return null;
  }
  if (!businessGoal || businessGoal.length > MAX_DESCRIPTION_LENGTH) return null;

  const analyticsContext = value.analyticsContext ?? null;
  if (
    analyticsContext !== null &&
    !Array.isArray(analyticsContext) &&
    !isRecord(analyticsContext)
  ) {
    return null;
  }
  if (!isBoundedJson(analyticsContext)) return null;

  let serializedContext: string;
  try {
    serializedContext = JSON.stringify(analyticsContext);
  } catch {
    return null;
  }
  if (Buffer.byteLength(serializedContext, "utf8") > MAX_ANALYTICS_CONTEXT_BYTES) {
    return null;
  }

  return {
    projectId,
    companyName,
    businessDescription,
    industry,
    businessGoal,
    analyticsContext,
  };
}

function callbackBaseUrl() {
  const configuredUrl = text(
    process.env.AI_MANAGER_CALLBACK_BASE_URL
  ).replace(/\/+$/, "");

  if (!configuredUrl) {
    throw new Error("AI_MANAGER_CALLBACK_BASE_URL is not configured.");
  }

  const url = new URL(configuredUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("AI_MANAGER_CALLBACK_BASE_URL must use HTTP or HTTPS.");
  }

  return url.toString().replace(/\/+$/, "");
}

async function finalizeFailedUsage(usageId: string, startedAt: number) {
  try {
    await failAiUsage({
      usageId,
      durationMs: Math.max(0, Date.now() - startedAt),
    });
  } catch {
    console.error("AI Manager usage failure finalization failed.");
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let parsedBody: unknown;

  try {
    parsedBody = await readLimitedJson(request, MAX_REQUEST_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    if (!(error instanceof MalformedJsonBodyError)) throw error;
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body = validateAiManagerRequestBody(parsedBody);
  if (!body) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const {
    projectId,
    companyName,
    businessDescription,
    industry,
    businessGoal,
    analyticsContext,
  } = body;

  let memory = null;

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!ownedProject) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    const [storedMemory] = await db
      .select()
      .from(projectMemory)
      .where(
        and(
          eq(projectMemory.projectId, projectId),
          eq(projectMemory.userId, userId)
        )
      )
      .limit(1);

    memory = storedMemory || null;
  } catch {
    console.error("AI Manager project authorization failed.");
    return Response.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  let callbackBase: string;

  try {
    callbackBase = callbackBaseUrl();
  } catch {
    console.error("AI Manager callback configuration is invalid.");
    return Response.json({ error: "Unable to start AI Manager job." }, { status: 500 });
  }

  const webhook = getN8nWebhookConfig("N8N_AI_MANAGER_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  const usageStartedAt = Date.now();
  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "ai-manager",
      workflow: "ai-manager",
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("AI Manager usage initialization failed.");
    return Response.json(
      { error: "Unable to track AI Manager request." },
      { status: 500 }
    );
  }

  let jobId: string;
  let jobStartedAt: number;

  try {
    const [job] = await db
      .insert(aiManagerJobs)
      .values({ userId, projectId, usageId, status: "pending" })
      .returning({ id: aiManagerJobs.id, createdAt: aiManagerJobs.createdAt });

    if (!job) {
      throw new Error("AI Manager job was not created.");
    }

    jobId = job.id;
    jobStartedAt = job.createdAt.getTime();
  } catch {
    await finalizeFailedUsage(usageId, usageStartedAt);
    console.error("AI Manager job creation failed.");
    return Response.json(
      { status: "failed", error: "Failed to start AI Manager job." },
      { status: 500 }
    );
  }

  const callbackUrl =
    `${callbackBase}/api/ai-manager/jobs/${encodeURIComponent(jobId)}`;
  const payload = {
    projectId,
    userId,
    companyName,
    businessDescription,
    industry,
    businessGoal,
    analyticsContext,
    projectMemory: memory,
    jobId,
    callbackUrl,
  };

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error("AI Manager workflow request failed.");
    }

    await db
      .update(aiManagerJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(aiManagerJobs.id, jobId),
          eq(aiManagerJobs.status, "pending")
        )
      );

    return Response.json({ jobId, status: "processing" }, { status: 202 });
  } catch {
    const failedJobs = await db
      .update(aiManagerJobs)
      .set({
        status: "failed",
        error: "Failed to start AI Manager job.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiManagerJobs.id, jobId),
          inArray(aiManagerJobs.status, ["pending", "processing"])
        )
      )
      .returning({ id: aiManagerJobs.id })
      .catch(() => {
        console.error("AI Manager job failure update failed.");
        return [];
      });

    if (failedJobs.length > 0) {
      await finalizeFailedUsage(usageId, jobStartedAt);
    }

    console.error("AI Manager workflow start failed.");
    return Response.json(
      { jobId, status: "failed", error: "Failed to start AI Manager job." },
      { status: 500 }
    );
  }
}
