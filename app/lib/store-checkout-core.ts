import { createHmac, timingSafeEqual } from "node:crypto";
import { validatePublicOrder, type PublicOrderInput } from "@/app/lib/public-order";

export const STORE_CHECKOUT_FLAG = "STORE_RAZORPAY_CHECKOUT_ENABLED";

const FORBIDDEN_CHECKOUT_KEYS = [
  "price", "amount", "subtotal", "total", "amountPaise", "totalPaise", "subtotalPaise",
  "paymentStatus", "merchantAccountId", "linkedAccountId", "providerOrderId", "providerPaymentId",
  "transfer", "transfers", "account", "providerAccountId",
] as const;

export function isStoreRazorpayCheckoutEnabled(env: NodeJS.Dict<string | undefined> = process.env): boolean {
  return env[STORE_CHECKOUT_FLAG] === "true";
}

export function calculateStoreCheckoutAmount(pricePaise: number, quantity: number): number | null {
  if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0) return null;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) return null;
  const total = pricePaise * quantity;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function merchantAccountCanAcceptCheckout(account: {
  projectId: string;
  expectedProjectId: string;
  provider: string;
  providerAccountId: string | null;
  status: string;
}): boolean {
  return account.projectId === account.expectedProjectId
    && account.provider === "razorpay"
    && account.status === "active"
    && typeof account.providerAccountId === "string"
    && /^acc_[A-Za-z0-9]+$/.test(account.providerAccountId);
}

export function buildStorePaymentOrderRequest(input: Readonly<{
  amountPaise: number;
  currency: "INR";
  receipt: string;
  linkedAccountId: string;
}>) {
  const transferAmount = input.amountPaise;
  return {
    amount: input.amountPaise,
    currency: "INR" as const,
    receipt: input.receipt,
    partial_payment: false as const,
    transfers: [{
      account: input.linkedAccountId,
      amount: transferAmount,
      currency: "INR" as const,
    }],
  };
}

export function storeRouteTransferIsValid(request: ReturnType<typeof buildStorePaymentOrderRequest>): boolean {
  const transfer = request.transfers[0];
  return request.partial_payment === false
    && request.currency === "INR"
    && transfer.currency === "INR"
    && transfer.amount === request.amount
    && transfer.amount <= request.amount
    && transfer.amount > 0
    && /^acc_[A-Za-z0-9]+$/.test(transfer.account);
}

export function isRetryableStorePaymentEvent(outcome: string | null | undefined, processedAt: Date | null | undefined): boolean {
  if (outcome === "processed" || outcome === "ignored_duplicate" || outcome === "ignored_unsupported") return false;
  if (outcome === "failed") return true;
  return !processedAt && !outcome;
}

export function storeCaptureMatchesPayment(input: {
  storedProviderOrderId: string | null;
  storedProviderPaymentId: string | null;
  storedAmountPaise: number;
  storedCurrency: string;
  payloadProviderOrderId: string | null;
  payloadProviderPaymentId: string | null;
  payloadAmount: number | null;
  payloadCurrency: string | null;
}): boolean {
  if (!input.storedProviderOrderId || input.payloadProviderOrderId !== input.storedProviderOrderId) return false;
  if (input.payloadAmount !== input.storedAmountPaise) return false;
  if (input.payloadCurrency !== "INR" || input.storedCurrency !== "INR") return false;
  if (input.storedProviderPaymentId && input.payloadProviderPaymentId
    && input.storedProviderPaymentId !== input.payloadProviderPaymentId) {
    return false;
  }
  return Boolean(input.payloadProviderPaymentId || input.storedProviderPaymentId);
}

export function parseStoreCheckoutRequest(body: unknown): { valid: true; slug: string; order: PublicOrderInput } | { valid: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { valid: false, error: "Please check your request." };
  const record = body as Record<string, unknown>;
  if (FORBIDDEN_CHECKOUT_KEYS.some((key) => key in record)) {
    return { valid: false, error: "Please check your request." };
  }
  const slugValue = record.publicSlug ?? record.slug;
  const checked = validatePublicOrder({
    slug: slugValue,
    productId: record.productId,
    quantity: record.quantity,
    name: record.name,
    email: record.email,
    phone: record.phone,
    address: record.address,
    note: record.note,
    company: record.company,
  });
  if (!checked.valid) return checked;
  const slug = typeof slugValue === "string" ? slugValue.trim().toLowerCase() : "";
  if (!slug) return { valid: false, error: "Business page not found." };
  return { valid: true, slug, order: checked.order };
}

export function verifyStoreCheckoutSignature(
  providerOrderId: string,
  providerPaymentId: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret || !providerOrderId || !providerPaymentId) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${providerOrderId}|${providerPaymentId}`).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function isStorePaymentCapturedEvent(eventType: string): boolean {
  return eventType === "payment.captured" || eventType === "order.paid";
}

export function canMarkStoreOrderPaid(paymentStatus: string): boolean {
  return paymentStatus === "unpaid" || paymentStatus === "pending" || paymentStatus === "paid";
}

export type StoreCheckoutProviderOrder = Readonly<{
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
}>;

export type StoreCheckoutProvider = Readonly<{
  createStorePaymentOrder(input: Readonly<{
    amountPaise: number;
    currency: "INR";
    receipt: string;
    linkedAccountId: string;
  }>): Promise<StoreCheckoutProviderOrder>;
}>;
