import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readBusinessDnaForOwner, updateBusinessDnaForOwner } from "@/app/lib/business-dna-store";
import { analyzeBusinessIntakeDeterministically } from "@/app/lib/business-intake-planner";
import { requestBusinessIntakeAnalysis, BUSINESS_INTAKE_MODEL, BusinessIntakeProviderError } from "@/app/lib/business-intake-provider";
import { claimIdempotentAiUsage, completeAiUsage, failAiUsage } from "@/app/lib/ai-usage";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import type { BusinessDna, BusinessDnaContent } from "@/app/lib/business-dna";
import { mergeExplicitDnaWithInferences, unansweredSuggestedQuestions, type BusinessIntakeAnalysis } from "@/app/lib/business-intake-analysis";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 8 * 1024;
const WORKFLOW = "openai-responses-business-intake";

function content(dna: BusinessDna): BusinessDnaContent {
  const value = structuredClone(dna) as BusinessDnaContent & { metadata?: BusinessDna["metadata"] };
  delete value.metadata;
  const conversation = value.conversation as BusinessDna["conversation"];
  if (conversation) {
    const mutable = conversation as Partial<NonNullable<BusinessDna["conversation"]>>;
    delete mutable.confirmed;
    delete mutable.confirmedAt;
    delete mutable.revisionCount;
  }
  return value;
}

type Dependencies = Readonly<{ verify: typeof verifyFirebaseIdToken; read: typeof readBusinessDnaForOwner; provider: typeof requestBusinessIntakeAnalysis;
  update: typeof updateBusinessDnaForOwner; claimUsage: typeof claimIdempotentAiUsage; completeUsage: typeof completeAiUsage; failUsage: typeof failAiUsage }>;
const dependencies: Dependencies = { verify: verifyFirebaseIdToken, read: readBusinessDnaForOwner, update: updateBusinessDnaForOwner, provider: requestBusinessIntakeAnalysis, claimUsage: claimIdempotentAiUsage, completeUsage: completeAiUsage, failUsage: failAiUsage };

async function persistAnalysisDraft(input: { deps: Dependencies; userId: string; projectId: string; savedDna: BusinessDnaContent; analysis: BusinessIntakeAnalysis }) {
  const mergedDraft = mergeExplicitDnaWithInferences(input.savedDna, input.analysis.extractedDna);
  const dna = await input.deps.update({ userId: input.userId, projectId: input.projectId, patch: mergedDraft, confirmed: false });
  if (!dna) throw new Error("project_not_found");
  return {
    dna,
    mergedDraft,
    analysis: { ...input.analysis, suggestedQuestions: unansweredSuggestedQuestions(input.analysis, mergedDraft) },
  };
}

function logFailure(input: { stage: string; requestId: string; providerHttpStatus?: number; code: string; issuePaths?: readonly string[]; responseDiagnostics?: BusinessIntakeProviderError["responseDiagnostics"] }) {
  console.error("Business intake analysis failed.", {
    stage: input.stage, requestId: input.requestId, providerHttpStatus: input.providerHttpStatus ?? null,
    code: input.code, validatorIssueCount: input.issuePaths?.length ?? 0, validatorIssuePaths: input.issuePaths ?? [],
    responseStatus: input.responseDiagnostics?.responseStatus ?? null,
    incompleteReason: input.responseDiagnostics?.incompleteReason ?? null,
    contentItemTypes: input.responseDiagnostics?.contentItemTypes ?? [],
    extractedTextLength: input.responseDiagnostics?.extractedTextLength ?? 0,
    beginsWithJsonObject: input.responseDiagnostics?.beginsWithJsonObject ?? false,
    endsWithJsonObject: input.responseDiagnostics?.endsWithJsonObject ?? false,
  });
}

export async function handleBusinessDnaAnalyze(request: Request, deps: Dependencies = dependencies) {
  let userId: string;
  try { userId = (await deps.verify(request)).uid; } catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Analysis request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid analysis request." }, { status: 400 });
    throw error;
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["projectId", "requestId"].includes(key))) return Response.json({ error: "Invalid analysis request." }, { status: 400 });
  const { projectId, requestId } = body as Record<string, unknown>;
  if (typeof projectId !== "string" || !projectId.trim() || projectId.length > 128 || typeof requestId !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(requestId)) return Response.json({ error: "Invalid analysis request." }, { status: 400 });
  const dna = await deps.read(userId, projectId.trim());
  if (dna === undefined) return Response.json({ error: "Project not found." }, { status: 404 });
  if (!dna?.conversation?.originalVisionText?.trim()) return Response.json({ error: "Tell us your business vision first." }, { status: 409 });
  const savedDna = content(dna);
  const input = { preferredLanguage: dna.conversation.preferredLanguage ?? "english", originalVisionText: dna.conversation.originalVisionText, savedDna } as const;
  if (process.env.BUSINESS_INTAKE_PROVIDER_ENABLED?.trim().toLowerCase() !== "true") {
    try {
      const draft = await persistAnalysisDraft({ deps, userId, projectId: projectId.trim(), savedDna, analysis: analyzeBusinessIntakeDeterministically(input) });
      return Response.json({ success: true, mode: "deterministic", requestId, analysis: draft.analysis, dna: draft.dna }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "Business analysis completed but its draft could not be saved safely." }, { status: 500 });
    }
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Business analysis is temporarily unavailable." }, { status: 503 });
  let usageId: string;
  const idempotentWorkflow = `${WORKFLOW}:${requestId}`;
  try {
    const claim = await deps.claimUsage({ userId, projectId: projectId.trim(), module: "business-intake", workflow: idempotentWorkflow, model: BUSINESS_INTAKE_MODEL });
    if (!claim.created) return Response.json({ error: "This analysis request was already processed.", requestId, status: claim.status }, { status: 409 });
    usageId = claim.usageId;
  }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: "Business analysis could not be started." }, { status: 500 }); }
  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof requestBusinessIntakeAnalysis>>;
  try {
    result = await deps.provider(input, { apiKey });
  } catch (error) {
    const detail = error instanceof BusinessIntakeProviderError ? error : new BusinessIntakeProviderError("provider_parse", "unexpected_provider_error");
    logFailure({ stage: detail.stage, requestId, providerHttpStatus: detail.httpStatus, code: detail.safeCode, issuePaths: detail.issuePaths, responseDiagnostics: detail.responseDiagnostics });
    await deps.failUsage({ usageId, durationMs: Date.now() - startedAt }).catch(() => logFailure({ stage: "usage_finalize", requestId, code: "fail_usage_failed" }));
    return Response.json({ error: "Business analysis failed. Your saved answers are safe.", requestId }, { status: 502 });
  }
  try {
    const draft = await persistAnalysisDraft({ deps, userId, projectId: projectId.trim(), savedDna, analysis: result.analysis });
    await deps.completeUsage({ usageId, durationMs: Date.now() - startedAt, model: BUSINESS_INTAKE_MODEL, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return Response.json({ success: true, mode: "provider", requestId, analysis: draft.analysis, dna: draft.dna }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logFailure({ stage: "usage_finalize", requestId, code: "complete_usage_failed" });
    await deps.failUsage({ usageId, durationMs: Date.now() - startedAt }).catch(() => undefined);
    return Response.json({ error: "Business analysis completed but could not be finalized safely.", requestId }, { status: 502 });
  }
}

export async function POST(request: Request) { return handleBusinessDnaAnalyze(request); }
