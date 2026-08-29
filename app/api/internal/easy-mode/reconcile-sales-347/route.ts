import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { readLimitedJson, MalformedJsonBodyError, RequestBodyTooLargeError } from "@/app/lib/request-body";
import {
  applySales347Reconciliation,
  SALES_347_EXECUTION_ID, SALES_347_PROJECT_ID, SALES_347_RUN_ID, SALES_347_TASK_ID, SALES_347_USAGE_ID,
  validateCurrentSales347, validateSales347Execution,
} from "@/app/lib/easy-mode-sales-347-reconciliation";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
type Dependencies = Readonly<{
  verify: typeof verifyFirebaseIdToken; isBoss: typeof isBossAdmin;
  parse: typeof validateSales347Execution;
  validate: typeof validateCurrentSales347; apply: typeof applySales347Reconciliation;
}>;
const defaults: Dependencies = {
  verify: verifyFirebaseIdToken, isBoss: isBossAdmin, parse: validateSales347Execution,
  validate: validateCurrentSales347, apply: applySales347Reconciliation,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function handleSales347Reconciliation(request: Request, dependencies: Dependencies = defaults) {
  let uid: string;
  try { uid = (await dependencies.verify(request)).uid; } catch { return Response.json({ error: "Not found." }, { status: 404 }); }
  if (!dependencies.isBoss(uid)) return Response.json({ error: "Not found." }, { status: 404 });
  let body: unknown;
  try { body = await readLimitedJson(request, MAX_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
    throw error;
  }
  if (!isRecord(body) || Object.keys(body).length !== 7 || !["validate", "reconcile"].includes(String(body.action)) ||
      body.projectId !== SALES_347_PROJECT_ID || body.runId !== SALES_347_RUN_ID || body.taskId !== SALES_347_TASK_ID ||
      body.usageId !== SALES_347_USAGE_ID || body.executionId !== SALES_347_EXECUTION_ID || !Object.hasOwn(body, "response")) {
    return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
  }
  try {
    const execution = dependencies.parse(body.response);
    if (!execution) throw new Error("Saved execution does not satisfy the fixed Sales 347 contract.");
    const result = body.action === "validate" ? await dependencies.validate(execution) : await dependencies.apply(execution);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Easy Mode Sales execution 347 reconciliation failed safely:",
      error instanceof Error ? error.message : error);
    return Response.json({ error: "Sales reconciliation could not be completed safely." }, { status: 409 });
  }
}

export const POST = (request: Request) => handleSales347Reconciliation(request);
