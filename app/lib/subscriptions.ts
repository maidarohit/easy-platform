import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import {
  statusGrantsPaidAccess,
  type SubscriptionPlan,
} from "@/app/lib/subscription-policy";
import { BILLING_PLAN, type BillingMarket } from "@/app/lib/billing-plans";
import { getBillingConfiguration } from "@/app/lib/billing-configuration";

export const PLAN_PRICES_PAISE = { business: BILLING_PLAN.prices.india.amountMinor } as const;
export const BILLING_MARKET_SAFE_FALLBACK = "india" as const;
export type BillingCurrency = (typeof BILLING_PLAN.prices)[BillingMarket]["currency"];

export function billingCurrencyForMarket(market: BillingMarket): BillingCurrency {
  return BILLING_PLAN.prices[market].currency;
}

export function billingMarketForProviderPlanId(
  providerPlanId: string | null | undefined,
): BillingMarket | null {
  if (!providerPlanId) return null;
  let planIds: ReturnType<typeof getBillingConfiguration>["planIds"];
  try {
    planIds = getBillingConfiguration().planIds;
  } catch {
    return null;
  }
  return (Object.entries(planIds).find(([, planId]) => planId === providerPlanId)?.[0] ?? null) as BillingMarket | null;
}

export function resolveSubscriptionBillingDetails(
  subscription: typeof subscriptions.$inferSelect | null,
) {
  if (!subscription) return null;
  const storedMarket = subscription.billingMarket;
  if (storedMarket === "india" || storedMarket === "international") {
    return {
      market: storedMarket,
      currency: billingCurrencyForMarket(storedMarket),
      source: "stored_market" as const,
      usedLegacyFallback: false,
    };
  }

  const derivedMarket = billingMarketForProviderPlanId(subscription.providerPlanId);
  if (derivedMarket) {
    return {
      market: derivedMarket,
      currency: billingCurrencyForMarket(derivedMarket),
      source: "provider_plan_id" as const,
      usedLegacyFallback: false,
    };
  }

  return {
    market: BILLING_MARKET_SAFE_FALLBACK,
    currency: billingCurrencyForMarket(BILLING_MARKET_SAFE_FALLBACK),
    source: "legacy_india_fallback" as const,
    usedLegacyFallback: true,
  };
}

export function getRazorpayPlanId(market: BillingMarket): string | null {
  return getBillingConfiguration().planIds[market] || null;
}

export async function getRazorpaySubscription(providerSubscriptionId: string) {
  if (!providerSubscriptionId.startsWith("sub_")) {
    throw new Error("Invalid Razorpay subscription ID.");
  }

  const { keyId, keySecret } = getBillingConfiguration();

  const response = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Razorpay subscription lookup failed (${response.status}).`);
  }

  const data: unknown = await response.json();

  if (!data || typeof data !== "object") {
    throw new Error("Razorpay returned an invalid subscription response.");
  }

  const entity = data as Record<string, unknown>;

  if (
    entity.id !== providerSubscriptionId ||
    typeof entity.status !== "string"
  ) {
    throw new Error("Razorpay returned an incomplete subscription.");
  }

  return {
    id: providerSubscriptionId,
    status: entity.status,
    checkoutUrl:
      typeof entity.short_url === "string" ? entity.short_url : null,
  };
}

export async function getUserSubscription(userId: string) {
  return (await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt)).limit(1))[0] ?? null;
}

export async function getUserEntitlements(userId: string) {
  const subscription = await getUserSubscription(userId);
  const billing = resolveSubscriptionBillingDetails(subscription);
  return {
    plan: subscription?.plan ?? null,
    status: subscription?.status ?? null,
    paidAccess: statusGrantsPaidAccess(subscription?.status ?? null),
    billingMarket: billing?.market ?? null,
    billingCurrency: billing?.currency ?? null,
    billingFallback: billing?.usedLegacyFallback ?? false,
  };
}

export class RazorpaySubscriptionCreationRejectedError extends Error {
  readonly status: number;
  readonly description: string | null;

  constructor(status: number, description: string | null) {
    super(`Razorpay rejected subscription creation (${status})${description ? `: ${description}` : "."}`);
    this.name = "RazorpaySubscriptionCreationRejectedError";
    this.status = status;
    this.description = description;
  }
}

function safeRazorpayErrorDescription(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;
  const description = (error as Record<string, unknown>).description;
  if (typeof description !== "string") return null;
  return description.replace(/[\r\n\t]/g, " ").slice(0, 500);
}

// A timeout or throttling response is delivery-uncertain: Razorpay may have
// accepted the request even though this process cannot establish the result.
export function isDefinitiveRazorpayCreationRejection(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export async function createRazorpaySubscription(planId: string, userId: string, plan: SubscriptionPlan, market: BillingMarket) {
  const { keyId, keySecret } = getBillingConfiguration();

  const expected = BILLING_PLAN.prices[market];
  const planResponse = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
  });
  if (!planResponse.ok) throw new Error(`Razorpay plan verification failed (${planResponse.status}).`);
  const providerPlan: unknown = await planResponse.json();
  const planEntity = providerPlan && typeof providerPlan === "object" ? providerPlan as { item?: unknown; period?: unknown; interval?: unknown } : null;
  const item = planEntity?.item;
  const verified = item && typeof item === "object" &&
    (item as { amount?: unknown }).amount === expected.amountMinor &&
    (item as { currency?: unknown }).currency === expected.currency &&
    planEntity?.period === "monthly" && planEntity.interval === 1;
  if (!verified) throw new Error("Razorpay plan price or currency does not match the authoritative billing offer.");

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: true,
      notes: { easy_platform_user_id: userId, easy_platform_plan: plan, easy_platform_market: market },
    }),
  });
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // The HTTP status remains useful even if Razorpay returned no JSON body.
    }
    const description = safeRazorpayErrorDescription(body);
    if (isDefinitiveRazorpayCreationRejection(response.status)) {
      throw new RazorpaySubscriptionCreationRejectedError(response.status, description);
    }
    throw new Error(`Razorpay subscription creation delivery uncertain (${response.status})${description ? `: ${description}` : "."}`);
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Razorpay returned an invalid response.");
  const entity = data as Record<string, unknown>;
  if (typeof entity.id !== "string" || !entity.id.startsWith("sub_") || typeof entity.short_url !== "string") throw new Error("Razorpay returned an incomplete subscription.");
  return { id: entity.id, checkoutUrl: entity.short_url };
}

export async function cancelRazorpaySubscription(providerSubscriptionId: string) {
  const { keyId, keySecret } = getBillingConfiguration();
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cancel_at_cycle_end: true }),
  });
  if (!response.ok) throw new Error(`Razorpay cancellation request failed (${response.status}).`);
}
