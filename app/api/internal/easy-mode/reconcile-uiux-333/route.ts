import {
  reconcileEasyModeUiux333,
  UIUX_333_PROJECT_ID,
  UIUX_333_PROVIDER_EXECUTION_ID,
} from "@/app/lib/easy-mode-uiux-333-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 256 * 1024;
type Reconcile = typeof reconcileEasyModeUiux333;
type AuthDependencies = Readonly<{ verify: typeof verifyFirebaseIdToken; isBoss: typeof isBossAdmin }>;
const defaultAuth: AuthDependencies = { verify: verifyFirebaseIdToken, isBoss: isBossAdmin };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function handleUiux333Reconciliation(
  request: Request,
  reconcile: Reconcile = reconcileEasyModeUiux333,
  auth: AuthDependencies = defaultAuth,
) {
  let uid: string;
  try { uid = (await auth.verify(request)).uid; } catch { return Response.json({ error: "Not found." }, { status: 404 }); }
  if (!auth.isBoss(uid)) return Response.json({ error: "Not found." }, { status: 404 });

  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Reconciliation request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
    throw error;
  }
  if (!isRecord(body) || Object.keys(body).some((key) => !["projectId", "executionId", "response", "dryRun"].includes(key)) ||
      Object.keys(body).length !== 4 || body.projectId !== UIUX_333_PROJECT_ID ||
      body.executionId !== UIUX_333_PROVIDER_EXECUTION_ID || typeof body.dryRun !== "boolean" || !Object.hasOwn(body, "response")) {
    return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
  }
  try {
    const result = await reconcile({
      projectId: UIUX_333_PROJECT_ID, executionId: UIUX_333_PROVIDER_EXECUTION_ID,
      response: body.response, dryRun: body.dryRun,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Easy Mode UIUX execution 333 reconciliation failed safely.");
    return Response.json({ error: "Reconciliation could not be completed safely." }, { status: 409 });
  }
}

export const POST = (request: Request) => handleUiux333Reconciliation(request);
