import { db } from "@/app/db";
import { aiManagerJobs, projectMemory, projects } from "@/app/db/schema";
import { failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  getN8nWebhookConfig,
  n8nConfigurationErrorResponse,
} from "@/app/lib/n8n-webhooks";
import { and, eq, inArray } from "drizzle-orm";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

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

  let body: Record<string, unknown>;

  try {
    const requestBody: unknown = await request.json();

    if (!isRecord(requestBody)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    body = requestBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = text(body.projectId);
  const companyName = text(body.companyName);
  const businessDescription = text(body.businessDescription);
  const industry = text(body.industry);
  const businessGoal = text(body.businessGoal);

  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  if (!companyName || !businessDescription || !industry || !businessGoal) {
    return Response.json(
      { error: "All business strategy fields are required." },
      { status: 400 }
    );
  }

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
    analyticsContext: body.analyticsContext ?? null,
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
    const [failedJob] = await db
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

    if (failedJob) {
      await finalizeFailedUsage(usageId, jobStartedAt);
    }

    console.error("AI Manager workflow start failed.");
    return Response.json(
      { jobId, status: "failed", error: "Failed to start AI Manager job." },
      { status: 500 }
    );
  }
}
