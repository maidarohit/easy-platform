import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  executeEasyModeRun,
  isEasyModeExecutionEnabled,
} from "@/app/lib/easy-mode-executor";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";

const MAX_BODY_BYTES = 1024;
type RouteContext = { params: Promise<{ runId: string }> };

function isEmptyObject(value: unknown): value is Record<string, never> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

export async function POST(request: Request, { params }: RouteContext) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!isEasyModeExecutionEnabled()) {
    return Response.json(
      { state: "disabled", message: "Business building is not available right now." },
      { status: 503 },
    );
  }

  if (request.body) {
    try {
      const body = await readLimitedJson(request, MAX_BODY_BYTES);
      if (!isEmptyObject(body)) {
        return Response.json({ error: "Invalid build request." }, { status: 400 });
      }
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return Response.json({ error: "Request is too large." }, { status: 413 });
      }
      if (error instanceof MalformedJsonBodyError) {
        return Response.json({ error: "Invalid build request." }, { status: 400 });
      }
      throw error;
    }
  }

  const result = await executeEasyModeRun({ runId: (await params).runId, userId });
  const status = result.state === "not_found" ? 404 :
    result.state === "not_available" ? 409 :
      result.state === "needs_attention" ? 422 : 200;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
