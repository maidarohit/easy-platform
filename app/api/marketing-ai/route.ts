import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import {
  parseAiUsageMetadata,
  type AiUsageComponent,
} from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const MARKETING_AI_WORKFLOW = "marketing-ai";

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
    console.error("Marketing AI usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  let uid: string;

  try {
    uid = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 }
    );
  }

  const validation = await readValidatedAiRequest(request, "marketing");
  if (!validation.ok) return validation.response;
  const body = validation.body;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 }
    );
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, uid)))
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
  } catch {
    console.error("Marketing AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_MARKETING_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId: uid,
      projectId,
      module: "marketing",
      workflow: MARKETING_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Marketing AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track Marketing AI request." },
      { status: 500 }
    );
  }

  const marketingPayload = { ...body };
  delete marketingPayload.projectId;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...webhook.headers,
      },
      body: JSON.stringify(marketingPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    console.log("N8N STATUS:", response.status);

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        {
          error: "Marketing AI request failed.",
        },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        {
          error: "n8n returned an empty response",
        },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(text);
      const usageFinalized = await finalizeUsage(
        usageId, "success", startedAt, usageMetadata?.components
      );
      if (n8nExecutionId) {
        try {
          await associateN8nExecution({
            usageId,
            executionId: n8nExecutionId,
            metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized,
          });
        } catch {
          console.error("Marketing AI execution association failed.");
        }
      }
      return NextResponse.json(data);
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Marketing AI returned invalid JSON." },
        { status: 502 }
      );
    }
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Marketing AI request failed.");

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
