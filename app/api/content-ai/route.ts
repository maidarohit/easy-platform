import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { CONTENT_AI_WORKFLOW, executeContentService } from "@/app/lib/content-execution";
import { createTrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { SpecialistExecutionError } from "@/app/lib/specialist-execution";
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
      await completeAiUsage({ usageId, durationMs, usageComponents });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
    return true;
  } catch {
    console.error("Content AI usage finalization failed.");
    return false;
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const validation = await readValidatedAiRequest(request, "content");
  if (!validation.ok) return validation.response;
  const body = validation.body;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!ownedProject) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
  } catch {
    console.error("Content AI project authorization failed.");
    return Response.json({ error: "Unable to authorize project." }, { status: 500 });
  }

  let usageId: string;
  try {
    usageId = await startAiUsage({
      userId,
      projectId,
      module: "content",
      workflow: CONTENT_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Content AI usage initialization failed.");
    return Response.json({ error: "Unable to track Content AI request." }, { status: 500 });
  }

  const contentPayload = { ...body };
  delete contentPayload.projectId;
  delete contentPayload.userId;
  const startedAt = Date.now();

  try {
    const result = await executeContentService({
      context: createTrustedModuleExecutionContext({ userId, projectId }),
      input: contentPayload,
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
        console.error("Content AI execution association failed.");
      }
    }
    return Response.json({ output: result.output.content }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Content AI request failed.");
    return Response.json({ error: "Something went wrong while generating content." }, {
      status: error instanceof SpecialistExecutionError ? error.httpStatus : 500,
    });
  }
}
