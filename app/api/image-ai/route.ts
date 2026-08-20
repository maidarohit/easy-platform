import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  getN8nWebhookConfig,
  n8nConfigurationErrorResponse,
} from "@/app/lib/n8n-webhooks";
import { and, eq } from "drizzle-orm";
const IMAGE_AI_WORKFLOW = "image-ai";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

async function finalizeUsage(
  usageId: string,
  status: "success" | "failed",
  startedAt: number
) {
  try {
    const durationMs = Date.now() - startedAt;
    if (status === "success") {
      await completeAiUsage({ usageId, durationMs });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
  } catch {
    console.error("Image AI usage finalization failed.");
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

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!ownedProject) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
  } catch {
    console.error("Image AI project authorization failed.");
    return Response.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  const webhook = getN8nWebhookConfig("N8N_IMAGE_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;
  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "image",
      workflow: IMAGE_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Image AI usage initialization failed.");
    return Response.json({ error: "Unable to track Image AI request." }, { status: 500 });
  }

  const imagePayload = { ...body };
  delete imagePayload.userId;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(imagePayload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Image generation failed." },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength === 0) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json({ error: "Image AI returned an empty image." }, { status: 502 });
    }

    if (!contentType.toLowerCase().startsWith("image/")) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json({ error: "Image AI returned invalid image data." }, { status: 502 });
    }

    await finalizeUsage(usageId, "success", startedAt);
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(imageBuffer.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Image AI request failed.");
    return Response.json({ error: "Image AI failed." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
