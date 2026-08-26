export const BILLING_PLANS = {
  pro: {
    key: "pro", name: "Starter", amountPaise: 199_900, currency: "INR", featured: false,
    displayPrice: "₹1,999", price: "₹1,999", period: "/month",
    description: "The complete Buzypeezy workspace for growing your business.",
    features: ["Connected business workspace", "AI business tools", "Saved projects and outputs"],
  },
  business: {
    key: "business", name: "Growth", amountPaise: 499_900, currency: "INR", featured: true,
    displayPrice: "₹4,999", price: "₹4,999", period: "/month",
    description: "Expanded capacity for established businesses and teams.",
    features: ["Everything in Starter", "Expanded business capacity", "Priority business support"],
  },
} as const;

export type BillingPlanKey = keyof typeof BILLING_PLANS;
export const BILLING_PLAN_KEYS = Object.keys(BILLING_PLANS) as BillingPlanKey[];
export const isBillingPlanKey = (value: unknown): value is BillingPlanKey =>
  typeof value === "string" && Object.hasOwn(BILLING_PLANS, value);
