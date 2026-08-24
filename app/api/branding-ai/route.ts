import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import {
  BRANDING_AI_WORKFLOW,
  BrandingExecutionError,
  executeBrandingService,
} from "@/app/lib/branding-execution";
import { createTrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { and, eq } from "drizzle-orm";

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
  const startedAt = Date.now();

  try {
    const result = await executeBrandingService({
      context: createTrustedModuleExecutionContext({ userId: uid, projectId }),
      input: brandingPayload,
    });
    const usageFinalized = await finalizeUsage(
      usageId,
      "success",
      startedAt,
      result.usageComponents
    );
    if (result.providerExecutionId) {
      try {
        await associateN8nExecution({
          usageId,
          executionId: result.providerExecutionId,
          metadataAlreadyApplied: Boolean(result.usageComponents) && usageFinalized,
        });
      } catch {
        console.error(
          "Branding AI execution association failed."
        );
      }
    }

    return Response.json({ output: result.output }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await finalizeUsage(
      usageId,
      "failed",
      startedAt
    );

    console.error("Branding AI request failed.");

    return Response.json({ error: "Branding AI failed." }, {
      status: error instanceof BrandingExecutionError ? error.httpStatus : 500,
    });
  }
}
