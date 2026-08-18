import { authorizeAutomationRequest } from "@/app/lib/automation-auth";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";

const WEBHOOK = "https://rohitm2026.app.n8n.cloud/webhook/automation-workflow";
const WORKFLOW = "automation-workflow";

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
    console.error("Workflow automation usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.ok) return authorization.response;

  const { body, projectId, userId } = authorization;
  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "automation-workflow",
      workflow: WORKFLOW,
    });
  } catch {
    console.error("Workflow automation usage initialization failed.");
    return Response.json(
      { error: "Unable to track workflow automation request." },
      { status: 500 }
    );
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const n8nResponse = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const usageMetadata = parseAiUsageMetadata(n8nResponse.headers);
    const n8nExecutionId = parseN8nExecutionId(n8nResponse.headers);
    const responseText = await n8nResponse.text();

    if (!n8nResponse.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Workflow automation failed." },
        { status: n8nResponse.status }
      );
    }

    if (!responseText.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Workflow automation returned an empty response." },
        { status: 502 }
      );
    }

    try {
      JSON.parse(responseText);
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return Response.json(
        { error: "Workflow automation returned an invalid response." },
        { status: 502 }
      );
    }

    const usageFinalized = await finalizeUsage(usageId, "success", startedAt, usageMetadata?.components);
    if (n8nExecutionId) {
      try {
        await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized });
      } catch {
        console.error("Workflow automation execution association failed.");
      }
    }
    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Workflow automation request failed.");
    return Response.json(
      { error: "Workflow automation failed." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
