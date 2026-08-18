export const SUBSCRIPTION_PLANS = ["pro", "business"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return typeof value === "string" && SUBSCRIPTION_PLANS.includes(value as SubscriptionPlan);
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
