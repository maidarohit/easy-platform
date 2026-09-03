import "server-only";

import { readLimitedRawBody, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { verifyRazorpayWebhook } from "@/app/lib/razorpay-webhook";
import { drizzleStoreCheckoutPersistence } from "@/app/lib/store-checkout-db";
import { isStoreRazorpayCheckoutEnabled } from "@/app/lib/store-checkout-core";
import { runStorePaymentWebhook } from "@/app/lib/store-checkout-service";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  if (!isStoreRazorpayCheckoutEnabled()) {
    return Response.json({ error: "Store checkout is not available." }, { status: 403 });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Your request is too large." }, { status: 413 });
    }
    throw error;
  }

  const secret = process.env.STORE_RAZORPAY_WEBHOOK_SECRET ?? "";
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  const verified = Boolean(secret) && verifyRazorpayWebhook(rawBody, signature, secret);
  const result = await runStorePaymentWebhook({
    rawBody: rawBody.toString("utf8"),
    signature,
    eventId,
    verified,
  }, { store: drizzleStoreCheckoutPersistence, env: process.env });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ success: true, outcome: result.outcome }, { headers: { "Cache-Control": "no-store" } });
}
