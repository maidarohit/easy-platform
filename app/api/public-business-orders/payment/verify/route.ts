import "server-only";

import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { drizzleStoreCheckoutPersistence } from "@/app/lib/store-checkout-db";
import { runStorePaymentVerification } from "@/app/lib/store-checkout-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 8_192);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Your request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Please check your request." }, { status: 400 });
    throw error;
  }

  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const result = await runStorePaymentVerification(body, {
    env: process.env,
    store: drizzleStoreCheckoutPersistence,
    secret,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({
    success: true,
    orderId: result.orderId,
    paymentStatus: result.paymentStatus,
  }, { headers: { "Cache-Control": "no-store" } });
}
