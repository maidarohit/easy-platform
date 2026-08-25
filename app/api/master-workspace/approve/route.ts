import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/app/db";
import { projectOutputs, projects } from "@/app/db/schema";
import {
  MODULE_ALIASES,
  validatedWorkspaceOutput,
} from "@/app/api/master-workspace/route";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const values = body as Record<string, unknown>;
  const projectId = validateEasyModeProjectId(values.projectId);
  const outputId = typeof values.outputId === "string" && UUID_PATTERN.test(values.outputId)
    ? values.outputId
    : null;
  if (!projectId || !outputId) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await db.transaction(async (transaction) => {
    const [ownedProject] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, projectId),
      eq(projects.userId, userId),
    )).limit(1);
    if (!ownedProject) return { status: 404 as const, error: "Project not found." };

    const [output] = await transaction.select({
      id: projectOutputs.id,
      module: projectOutputs.module,
      result: projectOutputs.result,
      approvedAt: projectOutputs.approvedAt,
    }).from(projectOutputs).where(and(
      eq(projectOutputs.id, outputId),
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
    )).limit(1);
    if (!output) return { status: 404 as const, error: "Generated output not found." };

    const moduleId = MODULE_ALIASES[output.module.toLowerCase()];
    if (!moduleId || !validatedWorkspaceOutput(moduleId, output.result)) {
      return { status: 409 as const, error: "This output is not ready for approval." };
    }
    if (output.approvedAt) {
      return { status: 200 as const, outputId: output.id, approvedAt: output.approvedAt };
    }

    const approvedAt = new Date();
    const [approved] = await transaction.update(projectOutputs).set({ approvedAt }).where(and(
      eq(projectOutputs.id, output.id),
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
      isNull(projectOutputs.approvedAt),
    )).returning({ id: projectOutputs.id, approvedAt: projectOutputs.approvedAt });

    if (approved?.approvedAt) {
      return { status: 200 as const, outputId: approved.id, approvedAt: approved.approvedAt };
    }
    const [concurrentlyApproved] = await transaction.select({
      id: projectOutputs.id,
      approvedAt: projectOutputs.approvedAt,
    }).from(projectOutputs).where(and(
      eq(projectOutputs.id, output.id),
      eq(projectOutputs.projectId, projectId),
      eq(projectOutputs.userId, userId),
    )).limit(1);
    if (!concurrentlyApproved?.approvedAt) {
      return { status: 409 as const, error: "This output could not be approved." };
    }
    return {
      status: 200 as const,
      outputId: concurrentlyApproved.id,
      approvedAt: concurrentlyApproved.approvedAt,
    };
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({
    outputId: result.outputId,
    approvedAt: result.approvedAt.toISOString(),
    reviewState: "Approved",
  }, { headers: { "Cache-Control": "no-store" } });
}
