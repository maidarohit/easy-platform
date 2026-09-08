import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import {
  claimIdempotentAiUsage,
  releaseFailedAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { loadOwnedSalesContext } from "@/app/lib/sales-business-context";
import { persistCompletedSalesGeneration } from "@/app/lib/sales-generation-persistence";
import { readStoredSalesInsights, sanitizeSalesInsights } from "@/app/lib/sales-insight-safety";
import { unwrapSalesProviderResponse } from "@/app/lib/sales-provider-response";
import { validateSalesOutput } from "@/app/lib/easy-mode-execution-contracts";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const SALES_AI_WORKFLOW = "sales-ai";

async function finalizeUsage(
  usageId: string,
  startedAt: number,
) {
  try {
    const durationMs = Date.now() - startedAt;

    await releaseFailedAiUsage({ usageId, durationMs });
    return true;
  } catch {
    console.error("Sales AI usage finalization failed.");
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
    const context = await loadOwnedSalesContext(uid, projectId);
    if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const rows = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "sales"),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(20);
    const salesStrategy = rows.map((row) => readStoredSalesInsights(row.result, context)).find(Boolean) ?? null;
    return NextResponse.json({ salesContext: context, salesStrategy }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("Sales context load failed.");
    return NextResponse.json({ error: "Unable to load Sales context." }, { status: 500 });
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

  const validation = await readValidatedAiRequest(request, "sales");
  if (!validation.ok) return validation.response;
  const body = validation.body;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 }
    );
  }

  let context: Awaited<ReturnType<typeof loadOwnedSalesContext>>;
  try {
    context = await loadOwnedSalesContext(uid, projectId);
    if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("Sales AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_SALES_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  const suppliedRequestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const requestId = /^[a-zA-Z0-9-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  let usageId: string;

  try {
    const claim = await claimIdempotentAiUsage({
      userId: uid,
      projectId,
      module: "sales",
      workflow: `${SALES_AI_WORKFLOW}--request-${requestId}`,
      model: null,
    });
    usageId = claim.usageId;
    if (!claim.created) {
      if (claim.status !== "success") return NextResponse.json({ error: "This Sales request is already being processed or did not complete." }, { status: 409 });
      const [saved] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
        eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "sales"),
      )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
      const salesStrategy = saved ? readStoredSalesInsights(saved.result, context) : null;
      return salesStrategy ? NextResponse.json({ salesContext: context, salesStrategy })
        : NextResponse.json({ error: "The completed Sales result could not be restored." }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Sales AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track Sales AI request." },
      { status: 500 }
    );
  }

  const salesPayload = {
    companyName: context.business.name,
    industry: context.business.industry,
    targetAudience: context.business.targetAudience,
    businessDescription: context.business.description,
    salesGoal: body.salesGoal || context.project.goal,
    verifiedBusinessContext: {
      website: context.website,
      location: context.business.location,
      services: context.business.services,
      channels: context.channels,
      enquiries: context.metrics.enquiries,
      orders: context.metrics.orders,
      paidOrders: context.metrics.paidOrders,
      paidRevenuePaise: context.metrics.paidRevenuePaise,
      currency: context.metrics.currency,
      enquiryToPaidOrderRate: context.metrics.enquiryToPaidOrderRate,
    },
    groundingRules: [
      "Treat verifiedBusinessContext as authoritative.",
      "Do not invent revenue, conversion, pricing, guarantees, targets, projections, customers, orders, or enquiries.",
      "Recommend validation with the business owner for any pricing or commercial terms not present in verifiedBusinessContext.",
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
      body: JSON.stringify(salesPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    if (!response.ok) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Sales AI request failed." },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Sales AI returned an empty response." },
        { status: 502 }
      );
    }

    const raw = unwrapSalesProviderResponse(text);
    const validated = validateSalesOutput(raw);
    const salesStrategy = sanitizeSalesInsights(validated, context);
    if (!salesStrategy) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json({ error: "Sales AI returned invalid JSON." }, { status: 502 });
    }
    try {
      await persistCompletedSalesGeneration({ usageId, userId: uid, projectId, result: salesStrategy, durationMs: Date.now() - startedAt, usageComponents: usageMetadata?.components });
    } catch {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json({ error: "Generated Sales strategy could not be saved. Your allowance was restored." }, { status: 500 });
    }
    if (n8nExecutionId) {
      try {
        await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) });
      } catch {
        console.error("Sales AI execution association failed.");
      }
    }
    return NextResponse.json({ salesContext: context, salesStrategy });
  } catch {
    await finalizeUsage(usageId, startedAt);
    console.error("Sales AI request failed.");

    return NextResponse.json(
      { error: "Failed to contact Sales AI" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
