import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const LOGO_AI_WEBHOOK = "https://rohitm2026.app.n8n.cloud/webhook/logo-ai";
const LOGO_AI_WORKFLOW = "logo-ai";

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
    console.error("Logo AI usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    const requestBody: unknown = await request.json();
    if (!isRecord(requestBody)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    body = requestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
  } catch {
    console.error("Logo AI project authorization failed.");
    return NextResponse.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  let usageId: string;
  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "logo",
      workflow: LOGO_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Logo AI usage initialization failed.");
    return NextResponse.json({ error: "Unable to track Logo AI request." }, { status: 500 });
  }

  const logoPayload = { ...body };
  delete logoPayload.projectId;
  delete logoPayload.userId;
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(LOGO_AI_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logoPayload),
      signal: controller.signal,
    });
    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const rawResponse = await response.text();

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json({ error: "Logo AI request failed." }, { status: response.status });
    }

    if (!rawResponse.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json({ error: "Logo AI returned an empty response." }, { status: 502 });
    }

    let data: unknown;
    try {
      data = JSON.parse(rawResponse);
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json({ error: "Logo AI returned invalid JSON." }, { status: 502 });
    }

    const usageFinalized = await finalizeUsage(usageId, "success", startedAt, usageMetadata?.components);
    if (n8nExecutionId) {
      try {
        await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized });
      } catch {
        console.error("Logo AI execution association failed.");
      }
    }
    return NextResponse.json(data);
  } catch (error) {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Logo AI request failed.");
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Logo AI timed out after 60 seconds." }, { status: 504 });
    }
    return NextResponse.json({ error: "Logo AI failed." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
