import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { completeAiUsage, failAiUsage, startAiUsage } from "@/app/lib/ai-usage";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { createTrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { executeLogoService, LOGO_AI_WORKFLOW } from "@/app/lib/logo-execution";
import { SpecialistExecutionError } from "@/app/lib/specialist-execution";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

  const validation = await readValidatedAiRequest(request, "logo");
  if (!validation.ok) return validation.response;
  const body = validation.body;

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
  const startedAt = Date.now();

  try {
    const result = await executeLogoService({
      context: createTrustedModuleExecutionContext({ userId, projectId }),
      input: logoPayload,
    });
    const usageFinalized = await finalizeUsage(usageId, "success", startedAt, result.usageComponents);
    if (result.providerExecutionId) {
      try {
        await associateN8nExecution({
          usageId,
          executionId: result.providerExecutionId,
          metadataAlreadyApplied: Boolean(result.usageComponents) && usageFinalized,
        });
      } catch {
        console.error("Logo AI execution association failed.");
      }
    }
    return NextResponse.json({ output: result.output });
  } catch (error) {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("Logo AI request failed.");
    return NextResponse.json({ error: "Logo AI failed." }, {
      status: error instanceof SpecialistExecutionError ? error.httpStatus : 500,
    });
  }
}
