import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  getN8nWebhookConfig,
  n8nConfigurationErrorResponse,
} from "@/app/lib/n8n-webhooks";
import { and, eq } from "drizzle-orm";
const VIDEO_AI_WORKFLOW = "video-ai";

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
    console.error("Video AI usage finalization failed.");
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
    console.error("Video AI project authorization failed.");
    return Response.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  const webhook = getN8nWebhookConfig("N8N_VIDEO_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;
  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "video",
      workflow: VIDEO_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Video AI usage initialization failed.");
    return Response.json({ error: "Unable to track Video AI request." }, { status: 500 });
  }

  const videoPayload = { ...body };
  delete videoPayload.userId;
  const startedAt = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(videoPayload),
      cache: "no-store",
    });

    if (!response.ok) {
      await response.body?.cancel();
      await finalizeUsage(usageId, "failed", startedAt);
      console.error("Video AI upstream request failed.", response.status);
      return new Response("Video generation failed.", { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const video = await response.arrayBuffer();

    if (video.byteLength === 0) {
      await finalizeUsage(usageId, "failed", startedAt);
      return new Response("Video AI returned an empty video response.", {
        status: 502,
      });
    }

    if (!contentType.toLowerCase().startsWith("video/")) {
      await finalizeUsage(usageId, "failed", startedAt);
      return new Response("Video AI returned invalid video data.", {
        status: 502,
      });
    }

    await finalizeUsage(usageId, "success", startedAt);
    return new Response(video, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Video AI request failed.");
    return new Response("Something went wrong while generating the video.", {
      status: 500,
    });
  }
}
