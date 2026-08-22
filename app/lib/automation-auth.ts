import "server-only";

import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq } from "drizzle-orm";
import { requirePaidEntitlement } from "@/app/lib/paid-entitlements";
import {
  readValidatedAiRequest,
  type AiRequestSchemaName,
} from "@/app/lib/ai-request-validation";

type AuthorizedAutomationRequest = {
  ok: true;
  body: Record<string, unknown>;
  projectId: string;
  userId: string;
};

type RejectedAutomationRequest = {
  ok: false;
  response: Response;
};

export async function authorizeAutomationRequest(
  request: Request,
  schema: Extract<AiRequestSchemaName, `automation-${string}`>,
): Promise<AuthorizedAutomationRequest | RejectedAutomationRequest> {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Authentication is required." },
        { status: 401 }
      ),
    };
  }

  const validation = await readValidatedAiRequest(request, schema);
  if (!validation.ok) return validation;
  const body = validation.body;

  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return {
      ok: false,
      response: Response.json(
        { error: "projectId is required." },
        { status: 400 }
      ),
    };
  }

  try {
    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!ownedProject) {
      return {
        ok: false,
        response: Response.json(
          { error: "Project not found." },
          { status: 404 }
        ),
      };
    }
  } catch {
    console.error("Automation project authorization failed.");
    return {
      ok: false,
      response: Response.json(
        { error: "Unable to authorize project." },
        { status: 500 }
      ),
    };
  }

  const entitlement = await requirePaidEntitlement(userId, "automationRuns");
  if (!entitlement.ok) return entitlement;

  return { ok: true, body, projectId, userId };
}
