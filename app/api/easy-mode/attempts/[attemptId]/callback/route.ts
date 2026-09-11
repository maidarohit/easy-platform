import { after } from "next/server";
import { executeEasyModeRun } from "@/app/lib/easy-mode-executor";
import {
  SpecialistCallbackError,
  specialistCallbackSecret,
  syncEasyModeSpecialistCallback,
  validateSpecialistCallbackBody,
} from "@/app/lib/easy-mode-specialist-callbacks";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";

const MAX_CALLBACK_BODY_BYTES = 256 * 1024;
type RouteContext = { params: Promise<{ attemptId: string }> };

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: Request, { params }: RouteContext) {
  const configuredSecret = specialistCallbackSecret();
  const suppliedSecret = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized callback." }, { status: 401 });
  }

  const { attemptId } = await params;
  let parsedBody: unknown;
  try {
    parsedBody = await readLimitedJson(request, MAX_CALLBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    if (error instanceof MalformedJsonBodyError) {
      return Response.json({ error: "Invalid callback body." }, { status: 400 });
    }
    throw error;
  }

  const body = validateSpecialistCallbackBody(parsedBody, attemptId);
  if (!body) return Response.json({ error: "Invalid callback body." }, { status: 400 });

  try {
    const result = await syncEasyModeSpecialistCallback(attemptId, body);
    const continuation = result.continuation;
    if (continuation) {
      after(async () => {
        try {
          await executeEasyModeRun(continuation);
        } catch (error) {
          console.error("Easy Mode continuation failed after specialist callback:", error);
        }
      });
    }
    return Response.json({
      attemptId,
      module: body.module,
      status: result.state === "ignored" ? "ignored" : body.status,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecialistCallbackError) {
      return Response.json({ error: error.message }, { status: error.httpStatus });
    }
    throw error;
  }
}
