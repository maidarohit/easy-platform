import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import {
  claimIdempotentAiUsage,
  releaseFailedAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { loadOwnedBusinessAnalytics } from "@/app/lib/analytics-metrics";
import { persistCompletedAnalyticsGeneration } from "@/app/lib/analytics-generation-persistence";
import { sanitizeAnalyticsInsights } from "@/app/lib/analytics-insight-safety";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const ANALYTICS_AI_WORKFLOW = "analytics-ai";

async function finalizeUsage(
  usageId: string,
  startedAt: number,
) {
  try {
    const durationMs = Date.now() - startedAt;

    await releaseFailedAiUsage({ usageId, durationMs });
    return true;
  } catch {
    console.error("Analytics AI usage finalization failed.");
    return false;
  }
}

export async function GET(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  try {
    const context = await loadOwnedBusinessAnalytics(uid, projectId);
    return context
      ? NextResponse.json({ businessMetrics: context.metrics }, { headers: { "Cache-Control": "private, no-store" } })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("Analytics metrics load failed.");
    return NextResponse.json({ error: "Unable to load business performance." }, { status: 500 });
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

  const validation = await readValidatedAiRequest(request, "analytics");
  if (!validation.ok) return validation.response;
  const body = validation.body;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 }
    );
  }

  let context: Awaited<ReturnType<typeof loadOwnedBusinessAnalytics>>;
  try {
    context = await loadOwnedBusinessAnalytics(uid, projectId);
    if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("Analytics AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_ANALYTICS_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  const suppliedRequestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const requestId = /^[a-zA-Z0-9-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  let usageId: string;

  try {
    const claim = await claimIdempotentAiUsage({
      userId: uid,
      projectId,
      module: "analytics",
      workflow: `${ANALYTICS_AI_WORKFLOW}--request-${requestId}`,
      model: null,
    });
    usageId = claim.usageId;
    if (!claim.created) {
      if (claim.status !== "success") return NextResponse.json({ error: "This Analytics request is already being processed or did not complete." }, { status: 409 });
      const [saved] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
        eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "analytics"),
      )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
      if (!saved) return NextResponse.json({ error: "The completed Analytics result could not be restored." }, { status: 500 });
      const analyticsInsights = typeof saved.result === "string" ? JSON.parse(saved.result) : saved.result;
      return NextResponse.json({ businessMetrics: context.metrics, analyticsInsights });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Analytics AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track Analytics AI request." },
      { status: 500 }
    );
  }

  const analyticsPayload = {
    companyName: context.project.companyName || context.project.name,
    industry: context.project.industry,
    businessDescription: context.project.description,
    businessGoal: body.businessGoal || context.project.goal,
    customerSupplied: {
      offlineSales: body.offlineSales || null,
      offlineRevenue: body.offlineRevenue || null,
      externalMarketingSpend: body.externalMarketingSpend || body.marketingBudget || null,
    },
    verifiedBusinessMetrics: context.metrics,
    groundingRules: [
      "Treat verifiedBusinessMetrics as authoritative.",
      "Visitors are not measured; do not estimate traffic, visitor conversion, ROI, CAC, or growth percentages.",
      "Label customerSupplied values as customer supplied, not measured by Buzypeezy.",
      "Do not invent revenue, leads, orders, customers, forecasts, or performance claims.",
    ],
  };
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...webhook.headers,
      },
      body: JSON.stringify(analyticsPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    console.log("Analytics Status:", response.status);

    if (!response.ok) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Analytics AI workflow failed." },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Analytics AI returned an empty response." },
        { status: 502 }
      );
    }

    try {
      const parsed = JSON.parse(text);
      const rawInsights = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        ? ((parsed as Record<string, unknown>).output && typeof (parsed as Record<string, unknown>).output === "object" ? (parsed as Record<string, unknown>).output : parsed) as Record<string, unknown>
        : null;
      const analyticsInsights = sanitizeAnalyticsInsights(rawInsights);
      if (!analyticsInsights) throw new Error("Invalid Analytics result.");
      try {
        await persistCompletedAnalyticsGeneration({ usageId, userId: uid, projectId, result: analyticsInsights, durationMs: Date.now() - startedAt, usageComponents: usageMetadata?.components });
      } catch {
        await finalizeUsage(usageId, startedAt);
        return NextResponse.json({ error: "Generated Analytics insights could not be saved. Your allowance was restored." }, { status: 500 });
      }
      if (n8nExecutionId) {
        try {
          await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) });
        } catch {
          console.error("Analytics AI execution association failed.");
        }
      }
      return NextResponse.json({ businessMetrics: context.metrics, analyticsInsights });
    } catch {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Analytics AI returned invalid JSON." },
        { status: 502 }
      );
    }
  } catch {
    await finalizeUsage(usageId, startedAt);
    console.error("Analytics AI request failed.");

    return NextResponse.json(
      { error: "Analytics AI failed." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
