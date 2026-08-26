import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BILLING_PLANS } from "../../app/lib/billing-plans.ts";
import { getBillingConfiguration } from "../../app/lib/billing-configuration.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("canonical registry owns the two INR monthly plans", () => {
  assert.deepEqual(Object.keys(BILLING_PLANS), ["pro", "business"]);
  assert.equal(BILLING_PLANS.pro.amountPaise, 199900);
  assert.equal(BILLING_PLANS.business.amountPaise, 499900);
  assert.equal(BILLING_PLANS.pro.currency, "INR");
});

test("customer surfaces use the registry and stale GBP pricing is retired", async () => {
  const [home, billing] = await Promise.all([source("app/page.tsx"), source("app/billing/page.tsx")]);
  assert.match(home, /BILLING_PLANS/); assert.match(billing, /BILLING_PLANS/);
  assert.doesNotMatch(home + billing, /£29|£79|Enterprise/);
  await assert.rejects(readFile(new URL("../../app/components/Pricing/Pricing.tsx", import.meta.url)), /ENOENT/);
});

test("billing mode and key mismatch fail closed without exposing secrets", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, { BILLING_MODE: "test", RAZORPAY_KEY_ID: "rzp_live_redacted", RAZORPAY_KEY_SECRET: "redacted", RAZORPAY_PRO_PLAN_ID: "plan_a", RAZORPAY_BUSINESS_PLAN_ID: "plan_b" });
    assert.throws(() => getBillingConfiguration(), /mode does not match/);
    process.env.RAZORPAY_KEY_ID = "rzp_test_redacted"; delete process.env.RAZORPAY_PRO_PLAN_ID;
    assert.throws(() => getBillingConfiguration(), /Plan IDs/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});

test("checkout reserves before Razorpay and rejects pending or active duplicates", async () => {
  const route = await source("app/api/billing/checkout/route.ts");
  const reserve = route.indexOf("transaction.insert(subscriptions)");
  const provider = route.indexOf("createRazorpaySubscription(getRazorpayPlanId(plan)");
  assert.ok(reserve >= 0 && reserve < provider);
  assert.match(route, /billing-checkout:/); assert.match(route, /current\?\.status === "pending"/);
  assert.match(route, /current\?\.status === "active"/); assert.match(route, /Plan changes are not available yet/);
  assert.match(route, /checkout_intent_/);
});

test("return UI is webhook-authoritative and customer friendly", async () => {
  const page = await source("app/billing/page.tsx");
  assert.match(page, /Waiting for payment confirmation/); assert.match(page, /Payment needs attention/);
  assert.match(page, /Subscription active/); assert.match(page, /subscription\?\.status === "pending"/);
  assert.doesNotMatch(page, /setStatus\([^)]*active/);
});

test("cancellation is authenticated, owner-derived, confirmed, and JSON-only", async () => {
  const route = await source("app/api/billing/cancel/route.ts");
  assert.match(route, /verifyFirebaseIdToken/); assert.match(route, /getUserSubscription\(uid\)/);
  assert.match(route, /confirm !== true/); assert.doesNotMatch(route, /providerSubscriptionId.*request|body.*providerSubscriptionId/);
  assert.match(route, /Response\.json/); assert.match(route, /cancelAtPeriodEnd: true/);
});

test("billing interactions contain no AI, n8n, or Business Build calls", async () => {
  const contents = await Promise.all(["app/billing/page.tsx", "app/api/billing/checkout/route.ts", "app/api/billing/cancel/route.ts"].map(source));
  assert.doesNotMatch(contents.join("\n"), /OpenAI|n8n|business-build|business-dna\/analyze/);
});
