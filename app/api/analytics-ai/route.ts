import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const ANALYTICS_AI_WEBHOOK =
  "https://rohitm2026.app.n8n.cloud/webhook/analytics-ai";
const ANALYTICS_AI_WORKFLOW = "analytics-ai";

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
    console.error("Analytics AI usage finalization failed.");
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

  let body: Record<string, unknown>;

  try {
    const requestBody: unknown = await request.json();

    if (!isRecord(requestBody)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    body = requestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

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
    console.error("Analytics AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId: uid,
      projectId,
      module: "analytics",
      workflow: ANALYTICS_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Analytics AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track Analytics AI request." },
      { status: 500 }
    );
  }

  const analyticsPayload = { ...body };
  delete analyticsPayload.projectId;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(ANALYTICS_AI_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analyticsPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    console.log("Analytics Status:", response.status);

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Analytics AI workflow failed." },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Analytics AI returned an empty response." },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(text);
      const usageFinalized = await finalizeUsage(usageId, "success", startedAt, usageMetadata?.components);
      if (n8nExecutionId) {
        try {
          await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized });
        } catch {
          console.error("Analytics AI execution association failed.");
        }
      }
      return NextResponse.json(data);
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "Analytics AI returned invalid JSON." },
        { status: 502 }
      );
    }
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Analytics AI request failed.");

    return NextResponse.json(
      { error: "Analytics AI failed." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
