import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  readLimitedRawBody,
  RequestBodyTooLargeError,
} from "../../app/lib/request-body.ts";
import { validateCheckoutBody } from "../../app/api/billing/checkout/route.ts";
import { POST as handleWebhook } from "../../app/api/billing/webhook/route.ts";
import { verifyRazorpayWebhook } from "../../app/lib/razorpay-webhook.ts";

function chunkedRequest(chunks, headers = {}) {
  const encoder = new TextEncoder();
  return new Request("https://example.test/webhook", {
    method: "POST",
    headers,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    duplex: "half",
  });
}

test("limited raw bodies preserve exact Razorpay signature bytes", async () => {
  const body = '{\n  "event": "subscription.activated"\n}';
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const rawBody = await readLimitedRawBody(
    new Request("https://example.test/webhook", { method: "POST", body }),
    256 * 1024,
  );

  assert.equal(verifyRazorpayWebhook(rawBody, signature, secret), true);
  assert.equal(verifyRazorpayWebhook(Buffer.concat([rawBody, Buffer.from(" ")]), signature, secret), false);
  assert.equal(verifyRazorpayWebhook(rawBody, "invalid", secret), false);
});

test("webhook handler accepts valid bytes and preserves invalid-signature behavior", async () => {
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const secret = "test-webhook-secret";
  const body = '{\n  "event": "ignored.test.event"\n}';
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;

  try {
    const validResponse = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-razorpay-signature": signature },
      body,
    }));
    assert.equal(validResponse.status, 200);

    const invalidResponse = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-razorpay-signature": "invalid" },
      body,
    }));
    assert.equal(invalidResponse.status, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  }
});

test("advertised and chunked oversized webhook bodies are rejected", async () => {
  const advertised = new Request("https://example.test/webhook", {
    method: "POST",
    headers: { "content-length": String(256 * 1024 + 1) },
    body: "{}",
  });
  await assert.rejects(readLimitedRawBody(advertised, 256 * 1024), RequestBodyTooLargeError);

  const chunked = chunkedRequest(["x".repeat(128 * 1024), "y".repeat(128 * 1024 + 1)]);
  await assert.rejects(readLimitedRawBody(chunked, 256 * 1024), RequestBodyTooLargeError);
});

test("webhook handler returns 413 before processing oversized bodies", async () => {
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";

  try {
    const advertisedResponse = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "content-length": String(256 * 1024 + 1) },
      body: "{}",
    }));
    assert.equal(advertisedResponse.status, 413);

    const chunkedResponse = await handleWebhook(
      chunkedRequest(["x".repeat(128 * 1024), "y".repeat(128 * 1024 + 1)]),
    );
    assert.equal(chunkedResponse.status, 413);
  } finally {
    if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  }
});

test("limited JSON distinguishes malformed and oversized checkout bodies", async () => {
  const malformed = new Request("https://example.test/checkout", {
    method: "POST",
    body: '{"plan":',
  });
  await assert.rejects(readLimitedJson(malformed, 2 * 1024), MalformedJsonBodyError);

  const oversized = chunkedRequest(["x".repeat(1024), "y".repeat(1025)]);
  await assert.rejects(readLimitedJson(oversized, 2 * 1024), RequestBodyTooLargeError);
});

test("checkout validation accepts only the two plan-only payloads", () => {
  assert.equal(validateCheckoutBody({ plan: "pro" }), "pro");
  assert.equal(validateCheckoutBody({ plan: "business" }), "business");
  assert.equal(validateCheckoutBody({ plan: "enterprise" }), null);
  assert.equal(validateCheckoutBody({ plan: "pro", amount: 1 }), null);
  assert.equal(validateCheckoutBody(["pro"]), null);
});
