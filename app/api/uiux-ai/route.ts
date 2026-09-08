import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import { claimIdempotentAiUsage, releaseFailedAiUsage } from "@/app/lib/ai-usage";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { validateUiuxOutput } from "@/app/lib/easy-mode-execution-contracts";
import { parseAiUsageMetadata } from "@/app/lib/ai-usage-metadata";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { validateWrappedWebhookOutput } from "@/app/lib/specialist-execution";
import { loadOwnedUiuxContext } from "@/app/lib/uiux-business-context";
import { persistCompletedUiuxGeneration } from "@/app/lib/uiux-generation-persistence";
import { readStoredUiuxOutput, sanitizeUiuxOutput } from "@/app/lib/uiux-insight-safety";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const WORKFLOW = "uiux-ai";
const validate = (value: unknown) => validateUiuxOutput(value);
async function release(usageId: string, startedAt: number) {
  try { await releaseFailedAiUsage({ usageId, durationMs: Date.now() - startedAt }); }
  catch { console.error("UI/UX AI usage finalization failed."); }
}

export async function GET(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  try {
    const context = await loadOwnedUiuxContext(uid, projectId);
    if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const rows = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "uiux"))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(20);
    const output = rows.map((row) => readStoredUiuxOutput(row.result, context, validate)).find(Boolean) ?? null;
    return NextResponse.json({ uiuxContext: context, output }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Unable to load UI/UX output." }, { status: 500 }); }
}

export async function POST(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); }
  const validation = await readValidatedAiRequest(request, "uiux");
  if (!validation.ok) return validation.response;
  const body = validation.body;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  const context = await loadOwnedUiuxContext(uid, projectId);
  if (!context) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const webhook = getN8nWebhookConfig("N8N_UIUX_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();
  const supplied = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const requestId = /^[a-zA-Z0-9-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  let usageId: string;
  try {
    const claim = await claimIdempotentAiUsage({ userId: uid, projectId, module: "uiux", workflow: `${WORKFLOW}--request-${requestId}`, model: null });
    usageId = claim.usageId;
    if (!claim.created) {
      if (claim.status !== "success") return NextResponse.json({ error: "This UI/UX request is already being processed or did not complete." }, { status: 409 });
      const [saved] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "uiux"))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
      const output = saved ? readStoredUiuxOutput(saved.result, context, validate) : null;
      return output ? NextResponse.json({ uiuxContext: context, output }) : NextResponse.json({ error: "The completed UI/UX result could not be restored." }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Unable to track UI/UX request." }, { status: 500 });
  }
  const startedAt = Date.now();
  try {
    const payload = { companyName: context.business.name, industry: context.business.industry, targetAudience: context.business.targetAudience, brandStyle: context.business.brandStyle, brandDescription: context.business.description,
      verifiedBusinessContext: { website: context.website, location: context.business.location, services: context.business.services, branding: context.branding },
      groundingRules: ["Treat verifiedBusinessContext as authoritative.", "Treat personas, research findings, metrics, conversion improvements, usability results, and accessibility compliance as unverified unless explicitly supplied."] };
    const response = await fetch(webhook.url, { method: "POST", headers: webhook.headers, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(120_000) });
    const usage = parseAiUsageMetadata(response.headers);
    const executionId = parseN8nExecutionId(response.headers);
    const raw = await response.text();
    if (!response.ok || !raw.trim()) { await release(usageId, startedAt); return NextResponse.json({ error: "UI/UX AI request failed." }, { status: response.ok ? 502 : response.status }); }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { await release(usageId, startedAt); return NextResponse.json({ error: "UI/UX AI returned invalid JSON." }, { status: 502 }); }
    const validated = validateWrappedWebhookOutput(parsed, validate);
    const output = validated ? sanitizeUiuxOutput(validated, context) : null;
    if (!output) { await release(usageId, startedAt); return NextResponse.json({ error: "UI/UX AI returned invalid output." }, { status: 502 }); }
    try { await persistCompletedUiuxGeneration({ usageId, userId: uid, projectId, result: output, durationMs: Date.now() - startedAt, usageComponents: usage?.components }); }
    catch { await release(usageId, startedAt); return NextResponse.json({ error: "Generated UI/UX output could not be saved. Your allowance was restored." }, { status: 500 }); }
    if (executionId) { try { await associateN8nExecution({ usageId, executionId, metadataAlreadyApplied: Boolean(usage) }); } catch { console.error("UI/UX execution association failed."); } }
    return NextResponse.json({ uiuxContext: context, output }, { headers: { "Cache-Control": "no-store" } });
  } catch { await release(usageId, startedAt); return NextResponse.json({ error: "UI/UX AI failed." }, { status: 500 }); }
}
