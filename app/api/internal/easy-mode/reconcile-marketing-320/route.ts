import { reconcileEasyModeMarketingResult } from "@/app/lib/easy-mode-marketing-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;
const RUN_ID = "5b327c31-dc34-4a37-aea8-3aef107a828e";
const PROJECT_ID = "5e56706a-41e9-498b-bf8a-134fffc8c06f";
const EXECUTION_KEY = "74bb8691-4566-4c00-9c48-c6853a4d81f8";

type Reconcile = typeof reconcileEasyModeMarketingResult;
type AuthDependencies = Readonly<{
  verify: typeof verifyFirebaseIdToken;
  isBoss: typeof isBossAdmin;
}>;
const defaultAuth: AuthDependencies = { verify: verifyFirebaseIdToken, isBoss: isBossAdmin };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function isAuthorized(request: Request, auth: AuthDependencies) {
  try {
    return auth.isBoss((await auth.verify(request)).uid);
  } catch {
    return false;
  }
}

export async function handleMarketing320Reconciliation(
  request: Request,
  reconcile: Reconcile = reconcileEasyModeMarketingResult,
  auth: AuthDependencies = defaultAuth,
) {
  if (!(await isAuthorized(request, auth))) return Response.json({ error: "Not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Reconciliation request is too large." }, { status: 413 });
    }
    if (error instanceof MalformedJsonBodyError) {
      return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
    }
    throw error;
  }
  if (!isRecord(body) || Object.keys(body).length !== 4 ||
      body.runId !== RUN_ID || body.projectId !== PROJECT_ID || body.executionKey !== EXECUTION_KEY ||
      !Object.hasOwn(body, "response")) {
    return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
  }
  try {
    const result = await reconcile({
      runId: RUN_ID,
      projectId: PROJECT_ID,
      executionKey: EXECUTION_KEY,
      response: body.response,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Easy Mode Marketing #320 reconciliation failed.");
    return Response.json({ error: "Reconciliation could not be completed safely." }, { status: 409 });
  }
}

export async function POST(request: Request) {
  return handleMarketing320Reconciliation(request);
}
