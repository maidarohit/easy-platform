import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  isSubscriptionPlan,
  statusForRazorpayEvent,
  statusGrantsPaidAccess,
} from "../../app/lib/subscription-policy.ts";
import { verifyRazorpayWebhook } from "../../app/lib/razorpay-webhook.ts";

test("only fixed self-service plans are accepted", () => {
  assert.equal(isSubscriptionPlan("pro"), true);
  assert.equal(isSubscriptionPlan("business"), true);
  assert.equal(isSubscriptionPlan("enterprise"), false);
  assert.equal(isSubscriptionPlan({ plan: "business", amount: 1 }), false);
});

test("only active provider state grants paid access", () => {
  assert.equal(statusGrantsPaidAccess("active"), true);
  for (const status of ["pending", "past_due", "cancelled", "expired", null]) {
    assert.equal(statusGrantsPaidAccess(status), false);
  }
});

test("Razorpay lifecycle maps failed and terminal states safely", () => {
  assert.equal(statusForRazorpayEvent("subscription.activated"), "active");
  assert.equal(statusForRazorpayEvent("subscription.charged"), "active");
  assert.equal(statusForRazorpayEvent("subscription.pending"), "past_due");
  assert.equal(statusForRazorpayEvent("subscription.halted"), "past_due");
  assert.equal(statusForRazorpayEvent("subscription.cancelled"), "cancelled");
  assert.equal(statusForRazorpayEvent("subscription.completed"), "expired");
});

test("webhook signature requires the exact raw body and is repeatable", () => {
  const body = '{"event":"subscription.activated"}';
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyRazorpayWebhook(body, signature, secret), true);
  assert.equal(verifyRazorpayWebhook(body, signature, secret), true);
  assert.equal(verifyRazorpayWebhook(`${body} `, signature, secret), false);
  assert.equal(verifyRazorpayWebhook(body, "invalid", secret), false);
});
