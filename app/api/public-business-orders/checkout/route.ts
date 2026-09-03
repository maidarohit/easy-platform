import "server-only";

import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { isStoreRazorpayCheckoutEnabled } from "@/app/lib/store-checkout-core";
import { drizzleStoreCheckoutPersistence } from "@/app/lib/store-checkout-db";
import { createRazorpayStorePaymentOrder, getStoreCheckoutPublicKey } from "@/app/lib/store-checkout-razorpay";
import { runStoreCheckout } from "@/app/lib/store-checkout-service";

export async function POST(request: Request) {
  if (!isStoreRazorpayCheckoutEnabled()) {
    return Response.json({ error: "Store checkout is not available." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, 8_192);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Your request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Please check your request." }, { status: 400 });
    throw error;
  }

  const result = await runStoreCheckout(body, {
    env: process.env,
    provider: { createStorePaymentOrder: createRazorpayStorePaymentOrder },
    store: drizzleStoreCheckoutPersistence,
    publicKey: getStoreCheckoutPublicKey(),
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, ...("orderId" in result && result.orderId ? { orderId: result.orderId } : {}) },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ success: true, checkout: result.checkout }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
