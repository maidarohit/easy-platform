export const BILLING_PLAN = {
  key: "business", name: "Buzypeezy Business", period: "/month",
  description: "One subscription for one business and one website.",
  features: ["One business workspace", "One active website", "All included Buzypeezy AI tools"],
  prices: {
    india: { amountMinor: 199_900, currency: "INR", displayPrice: "₹1,999", taxLabel: "applicable GST" },
    international: { amountMinor: 5_000, currency: "USD", displayPrice: "US$50", taxLabel: "applicable tax" },
  },
} as const;
export type BillingPlanKey = typeof BILLING_PLAN.key;
export type BillingMarket = keyof typeof BILLING_PLAN.prices;
export const BILLING_PLANS = { business: BILLING_PLAN } as const;
export const BILLING_PLAN_KEYS = [BILLING_PLAN.key] as const;
export const isBillingPlanKey = (value: unknown): value is BillingPlanKey => value === BILLING_PLAN.key;
export const marketForCountry = (country: string | null): BillingMarket =>
  country?.trim().toUpperCase() === "IN" ? "india" : "international";
