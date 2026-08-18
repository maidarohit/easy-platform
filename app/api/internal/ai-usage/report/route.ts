import { getAiUsageCostReport } from "@/app/lib/ai-usage-report";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.AI_USAGE_RECONCILIATION_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice(7);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);

  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    return Response.json(await getAiUsageCostReport(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("AI usage cost report failed.");
    return Response.json(
      { error: "Cost report is temporarily unavailable." },
      { status: 500 }
    );
  }
}
