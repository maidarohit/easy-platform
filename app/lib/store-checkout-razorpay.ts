import "server-only";

import { buildStorePaymentOrderRequest, storeRouteTransferIsValid, type StoreCheckoutProviderOrder } from "@/app/lib/store-checkout-core";

function storeCheckoutCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) throw new Error("Store payment credentials are not configured.");
  return { keyId, keySecret };
}

export function getStoreCheckoutPublicKey(): string | null {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  return keyId.startsWith("rzp_") ? keyId : null;
}

export async function createRazorpayStorePaymentOrder(input: Readonly<{
  amountPaise: number;
  currency: "INR";
  receipt: string;
  linkedAccountId: string;
}>): Promise<StoreCheckoutProviderOrder> {
  const { keyId, keySecret } = storeCheckoutCredentials();
  const payload = buildStorePaymentOrderRequest(input);
  if (!storeRouteTransferIsValid(payload)) throw new Error("Unable to create store payment order.");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Unable to create store payment order.");
  const body: unknown = await response.json();
  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : null;
  const amount = body && typeof body === "object" ? (body as { amount?: unknown }).amount : null;
  if (typeof id !== "string" || !id.startsWith("order_") || amount !== input.amountPaise) {
    throw new Error("Unable to create store payment order.");
  }
  return { providerOrderId: id, amountPaise: input.amountPaise, currency: "INR" };
}
