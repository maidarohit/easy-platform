import { reconcilePendingAiUsage } from "@/app/lib/ai-usage-reconciliation";
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

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const result = await reconcilePendingAiUsage();
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("AI usage reconciliation failed.");
    return Response.json(
      { error: "Reconciliation is temporarily unavailable." },
      { status: 500 }
    );
  }
}
