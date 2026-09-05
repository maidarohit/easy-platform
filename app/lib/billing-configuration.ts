import "server-only";
import { BILLING_PLAN, type BillingMarket } from "@/app/lib/billing-plans";

export type BillingMode = "test" | "live";
const keyMode = (keyId: string): BillingMode | null =>
  keyId.startsWith("rzp_test_") ? "test" : keyId.startsWith("rzp_live_") ? "live" : null;

export function getBillingConfiguration() {
  const mode = process.env.BILLING_MODE;
  if (mode !== "test" && mode !== "live") throw new Error("BILLING_MODE must be test or live.");
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) throw new Error("Razorpay API credentials are not configured.");
  if (keyMode(keyId) !== mode) throw new Error("Razorpay key mode does not match BILLING_MODE.");
  const planIds = { india: process.env.RAZORPAY_BUSINESS_INR_PLAN_ID ?? "", international: process.env.RAZORPAY_BUSINESS_USD_PLAN_ID ?? "" } satisfies Record<BillingMarket, string>;
  if (!planIds.india) throw new Error("The Razorpay India Business Plan ID is not configured.");
  return { mode, keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "", planIds };
}

export function getSafeBillingDiagnostics() {
  const mode = process.env.BILLING_MODE;
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  return {
    configured: Boolean(keyId && process.env.RAZORPAY_KEY_SECRET),
    mode: mode === "test" || mode === "live" ? mode : "invalid",
    keyMode: keyMode(keyId) ?? "invalid",
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    plans: Object.fromEntries(Object.entries(BILLING_PLAN.prices).map(([market, price]) => [market, {
      configured: Boolean(process.env[market === "india" ? "RAZORPAY_BUSINESS_INR_PLAN_ID" : "RAZORPAY_BUSINESS_USD_PLAN_ID"]),
      expectedCurrency: price.currency, expectedAmountMinor: price.amountMinor,
      providerAmountVerification: "required",
    }])),
  };
}
