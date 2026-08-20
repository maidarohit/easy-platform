import { NextResponse } from "next/server";
import { authorizeAutomationRequest } from "@/app/lib/automation-auth";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
const WORKFLOW = "automation-content";

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
    console.error("Content automation usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.ok) return authorization.response;

  const { body, projectId, userId } = authorization;
  const webhook = getN8nWebhookConfig("N8N_AUTOMATION_CONTENT_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "automation-content",
      workflow: WORKFLOW,
    });
  } catch {
    console.error("Content automation usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track content automation request." },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: webhook.headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Content automation failed." },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Content automation returned an empty response." },
        { status: 502 }
      );
    }

    const usageFinalized = await finalizeUsage(
      usageId,
      "success",
      startedAt,
      usageMetadata?.components
    );

    if (n8nExecutionId) {
      try {
        await associateN8nExecution({
          usageId,
          executionId: n8nExecutionId,
          metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized,
        });
      } catch {
        console.error("Content automation execution association failed.");
      }
    }

    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ content: text });
    }
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Content automation request failed.");

    return NextResponse.json(
      { error: "Failed to run content automation." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
