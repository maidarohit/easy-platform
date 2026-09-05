import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { marketForCountry, BILLING_PLAN } from "../../app/lib/billing-plans.ts";
import { validateCheckoutBody } from "../../app/api/billing/checkout/route.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("India and international offers are mutually exclusive by trusted country", () => {
  assert.equal(marketForCountry("IN"), "india");
  assert.equal(BILLING_PLAN.prices.india.displayPrice, "₹1,999");
  assert.equal(BILLING_PLAN.prices.india.currency, "INR");
  assert.equal(marketForCountry("AE"), "international");
  assert.equal(marketForCountry(null), "international");
  assert.equal(marketForCountry("unknown"), "international");
  assert.equal(BILLING_PLAN.prices.international.displayPrice, "US$50");
  assert.equal(BILLING_PLAN.prices.international.currency, "USD");
});

test("client billing fields cannot select India eligibility", () => {
  assert.equal(validateCheckoutBody({ plan: "business" }), "business");
  for (const field of ["amount", "currency", "country", "market", "planId"]) {
    assert.equal(validateCheckoutBody({ plan: "business", [field]: field === "amount" ? 1999 : "IN" }), null);
  }
});

test("all customer pricing surfaces render one server-selected offer", async () => {
  const [home, billing, offer, checkout] = await Promise.all([
    source("app/page.tsx"), source("app/billing/page.tsx"),
    source("app/api/billing/offer/route.ts"), source("app/api/billing/checkout/route.ts"),
  ]);
  assert.match(home, /billingMarketFromHeaders\(await headers\(\)\)/);
  assert.match(home, /offer\.displayPrice/);
  assert.doesNotMatch(home, /₹1,999 India \/ US\$50 international|mostSelected/);
  assert.match(billing, /fetch\("\/api\/billing\/offer"/);
  assert.doesNotMatch(billing, /₹1,999 \/ US\$50/);
  assert.match(offer, /billingMarketFromHeaders\(request\.headers\)/);
  assert.match(checkout, /billingMarketFromHeaders\(request\.headers\)/);
  assert.ok(checkout.indexOf("if (!providerPlanId)") < checkout.indexOf("transaction.insert(subscriptions)"));
  assert.match(checkout, /International payments are opening shortly\. Please check back soon\./);
});
