import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("checkout authenticates and accepts only a logical plan", async () => {
  const contents = await source("app/api/billing/checkout/route.ts");
  assert.match(contents, /verifyFirebaseIdToken/);
  assert.match(contents, /status:\s*401/);
  assert.match(contents, /isSubscriptionPlan\(plan\)/);
  assert.doesNotMatch(contents, /body\.(?:amount|price|userId|subscriptionId)/);
  assert.match(contents, /token\.uid/);
});

test("plan IDs, prices, and credentials remain server-side", async () => {
  const contents = await source("app/lib/subscriptions.ts");
  assert.match(contents, /RAZORPAY_PRO_PLAN_ID/);
  assert.match(contents, /RAZORPAY_BUSINESS_PLAN_ID/);
  assert.match(contents, /RAZORPAY_KEY_SECRET/);
  assert.doesNotMatch(contents, /NEXT_PUBLIC_RAZORPAY/);
});

test("webhook verifies raw body and updates only the provider subscription", async () => {
  const contents = await source("app/api/billing/webhook/route.ts");
  assert.match(contents, /await request\.text\(\)/);
  assert.match(contents, /verifyRazorpayWebhook/);
  assert.match(contents, /subscriptions\.providerSubscriptionId/);
  assert.match(contents, /notInArray\(subscriptions\.status, \["cancelled", "expired"\]\)/);
  assert.doesNotMatch(contents, /userId/);
});

test("billing status is scoped solely to verified token UID", async () => {
  const contents = await source("app/api/billing/status/route.ts");
  assert.match(contents, /verifyFirebaseIdToken/);
  assert.match(contents, /token\.uid/);
  assert.doesNotMatch(contents, /searchParams|request\.json/);
});
