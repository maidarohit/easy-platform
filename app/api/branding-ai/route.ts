import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import {
  claimIdempotentAiUsage,
  releaseFailedAiUsage,
} from "@/app/lib/ai-usage";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import {
  BRANDING_AI_WORKFLOW,
  BrandingExecutionError,
  executeBrandingService,
  loadCanonicalBrandingInput,
} from "@/app/lib/branding-execution";
import { persistCompletedBrandingGeneration } from "@/app/lib/branding-generation-persistence";
import { readStoredBrandingOutput } from "@/app/lib/branding-insight-safety";
import { createTrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { and, desc, eq } from "drizzle-orm";

async function finalizeUsage(
  usageId: string,
  startedAt: number,
) {
  try {
    const durationMs = Date.now() - startedAt;

    await releaseFailedAiUsage({ usageId, durationMs });

    return true;
  } catch {
    console.error("Branding AI usage finalization failed.");
    return false;
  }
}

export async function GET(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId) return Response.json({ error: "projectId is required." }, { status: 400 });
  const context = createTrustedModuleExecutionContext({ userId: uid, projectId });
  try {
    const canonicalInput = await loadCanonicalBrandingInput(context);
    const rows = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "branding"),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(20);
    const output = rows.map((row) => readStoredBrandingOutput(row.result, canonicalInput)).find(Boolean) ?? null;
    return Response.json({ output }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BrandingExecutionError && error.httpStatus === 404) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ error: "Unable to load Branding output." }, { status: 500 });
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

  const validation = await readValidatedAiRequest(request, "branding");
  if (!validation.ok) return validation.response;
  const body = validation.body;

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

  const context = createTrustedModuleExecutionContext({ userId: uid, projectId });
  let canonicalInput: Awaited<ReturnType<typeof loadCanonicalBrandingInput>>;
  try {
    canonicalInput = await loadCanonicalBrandingInput(context);
  } catch {
    console.error("Branding AI project authorization failed.");

    return Response.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const suppliedRequestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const requestId = /^[a-zA-Z0-9-]{8,128}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  let usageId: string;

  try {
    const claim = await claimIdempotentAiUsage({
      userId: uid,
      projectId,
      module: "branding",
      workflow: `${BRANDING_AI_WORKFLOW}--request-${requestId}`,
      model: null,
    });
    usageId = claim.usageId;
    if (!claim.created) {
      if (claim.status !== "success") return Response.json({ error: "This Branding request is already being processed or did not complete." }, { status: 409 });
      const [saved] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, uid), eq(projectOutputs.module, "branding"))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
      const output = saved ? readStoredBrandingOutput(saved.result, canonicalInput) : null;
      return output ? Response.json({ output }) : Response.json({ error: "The completed Branding result could not be restored." }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Branding AI usage initialization failed.");

    return Response.json(
      { error: "Unable to track Branding AI request." },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  try {
    const result = await executeBrandingService({
      context,
      input: canonicalInput,
    });
    try {
      await persistCompletedBrandingGeneration({ usageId, userId: uid, projectId, result: result.output, durationMs: Date.now() - startedAt, usageComponents: result.usageComponents });
    } catch {
      await finalizeUsage(usageId, startedAt);
      return Response.json({ error: "Generated Branding output could not be saved. Your allowance was restored." }, { status: 500 });
    }
    if (result.providerExecutionId) {
      try {
        await associateN8nExecution({
          usageId,
          executionId: result.providerExecutionId,
          metadataAlreadyApplied: Boolean(result.usageComponents),
        });
      } catch {
        console.error(
          "Branding AI execution association failed."
        );
      }
    }

    return Response.json({ output: result.output }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await finalizeUsage(usageId, startedAt);

    console.error("Branding AI request failed.");

    return Response.json({ error: "Branding AI failed." }, {
      status: error instanceof BrandingExecutionError ? error.httpStatus : 500,
    });
  }
}
