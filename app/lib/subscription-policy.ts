import { BILLING_PLAN_KEYS, isBillingPlanKey } from "@/app/lib/billing-plans";

export const SUBSCRIPTION_PLANS = BILLING_PLAN_KEYS;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return isBillingPlanKey(value);
}

export function statusGrantsPaidAccess(status: SubscriptionStatus | null): boolean {
  return status === "active";
}

export function statusForRazorpayEvent(event: string): SubscriptionStatus | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "active";
    case "subscription.authenticated":
      return "pending";
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.paused":
      return "past_due";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.completed":
      return "expired";
    default:
      return null;
  }
}
