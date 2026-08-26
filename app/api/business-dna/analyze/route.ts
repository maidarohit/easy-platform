import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readBusinessDnaForOwner } from "@/app/lib/business-dna-store";
import { analyzeBusinessIntakeDeterministically } from "@/app/lib/business-intake-planner";
import { requestBusinessIntakeAnalysis, BUSINESS_INTAKE_MODEL } from "@/app/lib/business-intake-provider";
import { startAiUsage, completeAiUsage, failAiUsage } from "@/app/lib/ai-usage";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import type { BusinessDna, BusinessDnaContent } from "@/app/lib/business-dna";

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
  startUsage: typeof startAiUsage; completeUsage: typeof completeAiUsage; failUsage: typeof failAiUsage }>;
const dependencies: Dependencies = { verify: verifyFirebaseIdToken, read: readBusinessDnaForOwner, provider: requestBusinessIntakeAnalysis, startUsage: startAiUsage, completeUsage: completeAiUsage, failUsage: failAiUsage };

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
    return Response.json({ success: true, mode: "deterministic", requestId, analysis: analyzeBusinessIntakeDeterministically(input) }, { headers: { "Cache-Control": "no-store" } });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Business analysis is temporarily unavailable." }, { status: 503 });
  let usageId: string;
  try { usageId = await deps.startUsage({ userId, projectId: projectId.trim(), module: "business-intake", workflow: WORKFLOW, model: BUSINESS_INTAKE_MODEL }); }
  catch (error) { if (error instanceof Response) return error; return Response.json({ error: "Business analysis could not be started." }, { status: 500 }); }
  const startedAt = Date.now();
  try {
    const result = await deps.provider(input, { apiKey });
    await deps.completeUsage({ usageId, durationMs: Date.now() - startedAt, model: BUSINESS_INTAKE_MODEL, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return Response.json({ success: true, mode: "provider", requestId, analysis: result.analysis }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await deps.failUsage({ usageId, durationMs: Date.now() - startedAt }).catch(() => undefined);
    return Response.json({ error: "Business analysis failed. Your saved answers are safe." }, { status: 502 });
  }
}

export async function POST(request: Request) { return handleBusinessDnaAnalyze(request); }
