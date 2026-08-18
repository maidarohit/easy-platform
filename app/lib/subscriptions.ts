import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import {
  statusGrantsPaidAccess,
  type SubscriptionPlan,
} from "@/app/lib/subscription-policy";

export const PLAN_PRICES_PAISE: Record<SubscriptionPlan, number> = {
  pro: 199900,
  business: 499900,
};

export function getRazorpayPlanId(plan: SubscriptionPlan): string {
  const value = process.env[plan === "pro" ? "RAZORPAY_PRO_PLAN_ID" : "RAZORPAY_BUSINESS_PLAN_ID"];
  if (!value) throw new Error(`Razorpay ${plan} plan is not configured.`);
  return value;
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

export async function createRazorpaySubscription(planId: string, userId: string, plan: SubscriptionPlan) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay API credentials are not configured.");

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
  if (!response.ok) throw new Error(`Razorpay subscription creation failed (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Razorpay returned an invalid response.");
  const entity = data as Record<string, unknown>;
  if (typeof entity.id !== "string" || typeof entity.short_url !== "string") throw new Error("Razorpay returned an incomplete subscription.");
  return { id: entity.id, checkoutUrl: entity.short_url };
}
