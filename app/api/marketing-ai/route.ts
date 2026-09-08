import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import {
  claimIdempotentAiUsage,
  releaseFailedAiUsage,
} from "@/app/lib/ai-usage";
import {
  parseAiUsageMetadata,
} from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";
import { persistCompletedMarketingGeneration } from "@/app/lib/marketing-generation-persistence";
import { sanitizeMarketingInsights } from "@/app/lib/marketing-insight-safety";
import { unwrapMarketingProviderResponse } from "@/app/lib/marketing-provider-response";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const MARKETING_AI_WORKFLOW = "marketing-ai";

async function finalizeUsage(
  usageId: string,
  startedAt: number,
) {
  try {
    const durationMs = Date.now() - startedAt;

    await releaseFailedAiUsage({ usageId, durationMs });
    return true;
  } catch {
    console.error("Marketing AI usage finalization failed.");
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
    const context = await loadOwnedMarketingContext(uid, projectId);
    return context ? NextResponse.json({ connectedBusinessContext: context }, { headers: { "Cache-Control": "private, no-store" } })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("Marketing business context load failed.");
    return NextResponse.json({ error: "Unable to load connected business context." }, { status: 500 });
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

  let context: Awaited<ReturnType<typeof loadOwnedMarketingContext>>;
  try {
    context = await loadOwnedMarketingContext(uid, projectId);
    if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("Marketing AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_MARKETING_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  const suppliedRequestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const requestId = /^[a-zA-Z0-9-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  let usageId: string;

  try {
    const claim = await claimIdempotentAiUsage({
      userId: uid,
      projectId,
      module: "marketing",
      workflow: `${MARKETING_AI_WORKFLOW}--request-${requestId}`,
      model: null,
    });
    usageId = claim.usageId;
    if (!claim.created) {
      if (claim.status !== "success") return NextResponse.json({ error: "This Marketing request is already being processed or did not complete." }, { status: 409 });
      const [saved] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "marketing"))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
      if (!saved) return NextResponse.json({ error: "The completed Marketing result could not be restored." }, { status: 500 });
      return NextResponse.json({ connectedBusinessContext: context, marketingStrategy: typeof saved.result === "string" ? JSON.parse(saved.result) : saved.result });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Marketing AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track Marketing AI request." },
      { status: 500 }
    );
  }

  const marketingPayload = {
    companyName: context.business.name,
    industry: context.business.industry,
    targetAudience: context.business.targetAudience,
    brandStyle: context.business.brandStyle,
    brandDescription: context.business.description,
    connectedBusinessContext: context,
    marketingGoal: body.marketingGoal || null,
    regenerateSection: body.regenerateSection || null,
    editInstruction: body.editInstruction || null,
    mode: body.mode || null,
    currentResult: body.currentResult || null,
    rules: [
      "Use only connectedBusinessContext as customer fact.",
      "Use the exact live URL for website CTAs when published; do not invent a URL when unpublished.",
      "A channel is usable only when its status is connected. WhatsApp approved_contact means contact only, not automated publishing.",
      "Never claim content was posted or published.",
      "Do not invent discounts, free consultations, testimonials, experience, locations, pricing, guarantees, visitors, engagement, CTR, ROI, CAC, conversion rates, or projections.",
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
      body: JSON.stringify(marketingPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    console.log("N8N STATUS:", response.status);

    if (!response.ok) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        {
          error: "Marketing AI request failed.",
        },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        {
          error: "n8n returned an empty response",
        },
        { status: 502 }
      );
    }

    try {
      const raw = unwrapMarketingProviderResponse(text);
      const cleaned = sanitizeMarketingInsights(raw, context);
      if (!cleaned) throw new Error("Invalid Marketing result.");
      const current = sanitizeMarketingInsights(body.currentResult, context) ?? {};
      const marketingStrategy = { ...current, ...cleaned };
      try {
        await persistCompletedMarketingGeneration({ usageId, userId: uid, projectId, result: marketingStrategy, durationMs: Date.now() - startedAt, usageComponents: usageMetadata?.components });
      } catch {
        await finalizeUsage(usageId, startedAt);
        return NextResponse.json({ error: "Generated Marketing strategy could not be saved. Your allowance was restored." }, { status: 500 });
      }
      if (n8nExecutionId) {
        try {
          await associateN8nExecution({
            usageId,
            executionId: n8nExecutionId,
            metadataAlreadyApplied: Boolean(usageMetadata),
          });
        } catch {
          console.error("Marketing AI execution association failed.");
        }
      }
      return NextResponse.json({ connectedBusinessContext: context, marketingStrategy });
    } catch {
      await finalizeUsage(usageId, startedAt);
      return NextResponse.json(
        { error: "Marketing AI returned invalid JSON." },
        { status: 502 }
      );
    }
  } catch {
    await finalizeUsage(usageId, startedAt);
    console.error("Marketing AI request failed.");

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
