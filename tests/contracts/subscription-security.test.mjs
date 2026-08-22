import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("checkout authenticates and accepts only a logical plan", async () => {
  const contents = await source("app/api/billing/checkout/route.ts");
  assert.match(contents, /verifyFirebaseIdToken/);
  assert.match(contents, /status:\s*401/);
  assert.match(contents, /readLimitedJson/);
  assert.match(contents, /MAX_CHECKOUT_BODY_BYTES\s*=\s*2\s*\*\s*1024/);
  assert.match(contents, /Object\.keys\(value\)\.length !== 1/);
  assert.doesNotMatch(contents, /body\.(?:amount|price|userId|subscriptionId)/);
  assert.match(contents, /token\.uid/);
  assert.ok(
    contents.indexOf("verifyFirebaseIdToken(request)") < contents.indexOf("readLimitedJson(request"),
    "checkout must authenticate before reading the request body",
  );
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
  assert.match(contents, /readLimitedRawBody/);
  assert.match(contents, /MAX_WEBHOOK_BODY_BYTES\s*=\s*256\s*\*\s*1024/);
  assert.match(contents, /verifyRazorpayWebhook/);
  assert.match(contents, /subscriptions\.providerSubscriptionId/);
  assert.match(contents, /notInArray\(subscriptions\.status, \["cancelled", "expired"\]\)/);
  assert.doesNotMatch(contents, /userId/);
  assert.ok(
    contents.indexOf("readLimitedRawBody(request") < contents.indexOf("db.update(subscriptions)"),
    "oversized webhook bodies must be rejected before subscription mutation",
  );
});

test("billing status is scoped solely to verified token UID", async () => {
  const contents = await source("app/api/billing/status/route.ts");
  assert.match(contents, /verifyFirebaseIdToken/);
  assert.match(contents, /token\.uid/);
  assert.doesNotMatch(contents, /searchParams|request\.json/);
});
