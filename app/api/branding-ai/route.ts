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
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { and, eq } from "drizzle-orm";

const BRANDING_AI_WORKFLOW = "branding-api";

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
      await completeAiUsage({
        usageId,
        durationMs,
        usageComponents,
      });
    } else {
      await failAiUsage({
        usageId,
        durationMs,
      });
    }

    return true;
  } catch {
    console.error("Branding AI usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  let uid: string;

  try {
    uid = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json(
      { error: "Authentication is required." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;

  try {
    const requestBody: unknown = await request.json();

    if (!isRecord(requestBody)) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    body = requestBody;
  } catch {
    return Response.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const projectId =
    typeof body.projectId === "string"
      ? body.projectId.trim()
      : "";

  if (!projectId) {
    return Response.json(
      { error: "projectId is required." },
      { status: 400 }
    );
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, uid)
        )
      )
      .limit(1);

    if (!ownedProject) {
      return Response.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }
  } catch {
    console.error("Branding AI project authorization failed.");

    return Response.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_BRANDING_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId: uid,
      projectId,
      module: "branding",
      workflow: BRANDING_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Branding AI usage initialization failed.");

    return Response.json(
      { error: "Unable to track Branding AI request." },
      { status: 500 }
    );
  }

  const brandingPayload = { ...body };

  delete brandingPayload.projectId;
  delete brandingPayload.userId;

  const controller = new AbortController();
  const startedAt = Date.now();

  const timeout = setTimeout(
    () => controller.abort(),
    120_000
  );

  try {
    const upstream = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...webhook.headers,
      },
      body: JSON.stringify(brandingPayload),
      cache: "no-store",
      signal: controller.signal,
    });

    const usageMetadata =
      parseAiUsageMetadata(upstream.headers);

    const n8nExecutionId =
      parseN8nExecutionId(upstream.headers);

    const responseText = await upstream.text();

    if (!upstream.ok) {
      await finalizeUsage(
        usageId,
        "failed",
        startedAt
      );

      console.error("Branding AI upstream request failed.", upstream.status);
      return Response.json(
        { error: "Branding AI request failed." },
        { status: upstream.status }
      );
    }

    if (!responseText.trim()) {
      await finalizeUsage(
        usageId,
        "failed",
        startedAt
      );

      return Response.json(
        {
          error:
            "Branding AI returned an empty response.",
        },
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
          metadataAlreadyApplied:
            Boolean(usageMetadata) &&
            usageFinalized,
        });
      } catch {
        console.error(
          "Branding AI execution association failed."
        );
      }
    }

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    await finalizeUsage(
      usageId,
      "failed",
      startedAt
    );

    console.error("Branding AI request failed.");

    return Response.json(
      { error: "Branding AI failed." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
