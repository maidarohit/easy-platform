import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import {
  statusGrantsPaidAccess,
  type SubscriptionPlan,
} from "@/app/lib/subscription-policy";
import { BILLING_PLANS } from "@/app/lib/billing-plans";
import { getBillingConfiguration } from "@/app/lib/billing-configuration";

export const PLAN_PRICES_PAISE: Record<SubscriptionPlan, number> = {
  pro: BILLING_PLANS.pro.amountPaise,
  business: BILLING_PLANS.business.amountPaise,
};

export function getRazorpayPlanId(plan: SubscriptionPlan): string {
  return getBillingConfiguration().planIds[plan];
}

export async function getUserSubscription(userId: string) {
  return (await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt)).limit(1))[0] ?? null;
}

export async function getUserEntitlements(userId: string) {
  const subscription = await getUserSubscription(userId);
  return {
    plan: subscription?.plan ?? null,
    status: subscription?.status ?? null,
    paidAccess: statusGrantsPaidAccess(subscription?.status ?? null),
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

export async function createRazorpaySubscription(planId: string, userId: string, plan: SubscriptionPlan) {
  const { keyId, keySecret } = getBillingConfiguration();

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
      notes: { easy_platform_user_id: userId, easy_platform_plan: plan },
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
