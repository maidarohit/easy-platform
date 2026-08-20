import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import {
  getN8nWebhookConfig,
  n8nConfigurationErrorResponse,
} from "@/app/lib/n8n-webhooks";
import { and, eq } from "drizzle-orm";
const PRESENTATION_AI_WORKFLOW = "presentation-ai";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

async function finalizeUsage(
  usageId: string,
  status: "success" | "failed",
  startedAt: number,
  usageComponents?: readonly AiUsageComponent[]
) {
  try {
    const durationMs = Date.now() - startedAt;
    if (status === "success") {
      await completeAiUsage({ usageId, durationMs, usageComponents });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
    return true;
  } catch {
    console.error("Presentation AI usage finalization failed.");
    return false;
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
    console.error("Presentation AI project authorization failed.");
    return Response.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  const webhook = getN8nWebhookConfig("N8N_PRESENTATION_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;
  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "presentation",
      workflow: PRESENTATION_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Presentation AI usage initialization failed.");
    return Response.json(
      { error: "Unable to track Presentation AI request." },
      { status: 500 }
    );
  }

  const presentationPayload = { ...body };
  delete presentationPayload.userId;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(presentationPayload),
      cache: "no-store",
      signal: controller.signal,
    });
    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const responseText = await response.text();

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      console.error("Presentation AI upstream request failed.", response.status);
      return Response.json(
        { error: "Presentation generation failed." },
        { status: response.status }
      );
    }

    if (!responseText.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Presentation AI returned an empty response." },
        { status: 502 }
      );
    }

    try {
      JSON.parse(responseText);
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Presentation AI returned invalid JSON." },
        { status: 502 }
      );
    }

    const usageFinalized = await finalizeUsage(usageId, "success", startedAt, usageMetadata?.components);
    if (n8nExecutionId) {
      try {
        await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized });
      } catch {
        console.error("Presentation AI execution association failed.");
      }
    }
    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Presentation AI request failed.");
    return Response.json(
      { error: "Something went wrong while generating the presentation." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
