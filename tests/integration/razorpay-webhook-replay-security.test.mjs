import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  POST as handleWebhook,
  processValidatedSubscriptionEvent,
  subscriptionEventOutcome,
  validateSupportedSubscriptionEvent,
} from "../../app/api/billing/webhook/route.ts";
import {
  razorpayWebhookEvents,
  subscriptions,
} from "../../app/db/schema.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function supportedEvent(overrides = {}) {
  return {
    event: "subscription.activated",
    created_at: 1_800_000_000,
    payload: { subscription: { entity: { id: "sub_test_bounded" } } },
    ...overrides,
  };
}

function validatedEvent(eventId, eventName, createdAt) {
  const validated = validateSupportedSubscriptionEvent(
    supportedEvent({ event: eventName, created_at: createdAt }),
    eventId,
  );
  assert.ok(validated);
  return validated;
}

class FakeWebhookDatabase {
  constructor(status = "pending") {
    this.subscription = status === null ? null : { status };
    this.events = new Map();
    this.subscriptionMutations = 0;
    this.locks = 0;
    this.failNextLock = false;
    this.queue = Promise.resolve();
  }

  async transaction(work) {
    const previous = this.queue;
    let release;
    this.queue = new Promise((resolve) => { release = resolve; });
    await previous;

    const pending = {
      subscription: this.subscription ? { ...this.subscription } : null,
      events: new Map([...this.events].map(([key, value]) => [key, { ...value }])),
      subscriptionMutations: this.subscriptionMutations,
      locks: this.locks,
    };

    const tx = {
      insert: (table) => {
        assert.equal(table, razorpayWebhookEvents);
        return {
          values: (value) => ({
            onConflictDoNothing: () => ({
              returning: async () => {
                if (pending.events.has(value.providerEventId)) return [];
                pending.events.set(value.providerEventId, {
                  ...value,
                  processedAt: null,
                  outcome: null,
                });
                return [{ providerEventId: value.providerEventId }];
              },
            }),
          }),
        };
      },
      execute: async () => {
        pending.locks += 1;
        if (this.failNextLock) {
          this.failNextLock = false;
          throw new Error("forced local transaction failure");
        }
      },
      select: () => ({
        from: (table) => {
          if (table === subscriptions) {
            return {
              where: () => ({
                limit: async () => pending.subscription ? [{ ...pending.subscription }] : [],
              }),
            };
          }
          assert.equal(table, razorpayWebhookEvents);
          return {
            where: () => ({
              orderBy: () => ({
                limit: async () => {
                  const processed = [...pending.events.values()]
                    .filter((event) => event.processedAt)
                    .sort((left, right) => right.providerCreatedAt - left.providerCreatedAt);
                  return processed.length > 0
                    ? [{ providerCreatedAt: processed[0].providerCreatedAt }]
                    : [];
                },
              }),
            }),
          };
        },
      }),
      update: (table) => ({
        set: (values) => ({
          where: async () => {
            if (table === subscriptions) {
              assert.ok(pending.subscription);
              pending.subscription = { ...pending.subscription, ...values };
              pending.subscriptionMutations += 1;
              return;
            }
            assert.equal(table, razorpayWebhookEvents);
            const current = [...pending.events.entries()].find(([, event]) => !event.processedAt);
            assert.ok(current);
            pending.events.set(current[0], { ...current[1], ...values });
          },
        }),
      }),
    };

    try {
      const result = await work(tx);
      this.subscription = pending.subscription;
      this.events = pending.events;
      this.subscriptionMutations = pending.subscriptionMutations;
      this.locks = pending.locks;
      return result;
    } finally {
      release();
    }
  }
}

function signedRequest(body, secret, headers = {}) {
  return new Request("https://example.test/api/billing/webhook", {
    method: "POST",
    headers: {
      "x-razorpay-signature": createHmac("sha256", secret).update(body).digest("hex"),
      ...headers,
    },
    body,
  });
}

async function withWebhookSecret(value, work) {
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (value === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = value;
  try {
    return await work();
  } finally {
    if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
  }
}

test("supported events require bounded provider event ID and signed root timestamp", () => {
  const event = supportedEvent();
  const validated = validateSupportedSubscriptionEvent(event, "evt_test_1");
  assert.equal(validated?.providerEventId, "evt_test_1");
  assert.equal(validated?.providerSubscriptionId, "sub_test_bounded");
  assert.equal(validated?.providerCreatedAt.getTime(), event.created_at * 1000);
  assert.throws(() => validateSupportedSubscriptionEvent(event, null), TypeError);
  assert.throws(() => validateSupportedSubscriptionEvent(event, "x".repeat(201)), TypeError);
  assert.throws(
    () => validateSupportedSubscriptionEvent(supportedEvent({ created_at: "1800000000" }), "evt_test_2"),
    TypeError,
  );
  assert.throws(
    () => validateSupportedSubscriptionEvent(supportedEvent({ created_at: -1 }), "evt_test_3"),
    TypeError,
  );
});

test("unsupported signed events preserve safe no-ledger behavior", () => {
  assert.equal(
    validateSupportedSubscriptionEvent({ event: "payment.authorized" }, null),
    null,
  );
});

test("strictly older nonterminal events are stale", () => {
  const newer = new Date("2026-08-23T12:00:01.000Z");
  const older = new Date("2026-08-23T12:00:00.000Z");
  assert.equal(subscriptionEventOutcome("active", "past_due", older, newer), "ignored_stale");
  assert.equal(subscriptionEventOutcome("active", "pending", older, newer), "ignored_stale");
});

test("terminal subscriptions cannot reactivate", () => {
  const oldEvent = new Date("2026-08-23T12:00:00.000Z");
  const latest = new Date("2026-08-23T12:00:01.000Z");
  assert.equal(subscriptionEventOutcome("cancelled", "active", oldEvent, latest), "ignored_stale");
  assert.equal(subscriptionEventOutcome("cancelled", "active", latest, latest), "ignored_terminal");
  assert.equal(subscriptionEventOutcome("expired", "active", latest, latest), "ignored_terminal");
});

test("newer terminal events may change terminal state", () => {
  const latest = new Date("2026-08-23T12:00:00.000Z");
  const newer = new Date("2026-08-23T12:00:01.000Z");
  assert.equal(subscriptionEventOutcome("cancelled", "expired", newer, latest), "processed");
  assert.equal(subscriptionEventOutcome("expired", "cancelled", newer, latest), "processed");
});

test("same-timestamp terminal events do not flip terminal state", () => {
  const timestamp = new Date("2026-08-23T12:00:00.000Z");
  assert.equal(
    subscriptionEventOutcome("cancelled", "expired", timestamp, timestamp),
    "ignored_terminal",
  );
});

test("first delivery mutates once and exact duplicate performs no mutation", async () => {
  const database = new FakeWebhookDatabase();
  const event = validatedEvent("evt_exact_duplicate", "subscription.activated", 1_800_000_010);
  assert.equal(await processValidatedSubscriptionEvent(event, database), "processed");
  assert.equal(database.events.size, 1);
  assert.equal(database.subscription.status, "active");
  assert.equal(database.subscriptionMutations, 1);

  assert.equal(await processValidatedSubscriptionEvent(event, database), "duplicate");
  assert.equal(database.events.size, 1);
  assert.equal(database.subscriptionMutations, 1);
});

test("concurrent duplicate deliveries reserve and mutate exactly once", async () => {
  const database = new FakeWebhookDatabase();
  const event = validatedEvent("evt_concurrent_duplicate", "subscription.charged", 1_800_000_020);
  const results = await Promise.all([
    processValidatedSubscriptionEvent(event, database),
    processValidatedSubscriptionEvent(event, database),
  ]);
  assert.deepEqual(results.sort(), ["duplicate", "processed"]);
  assert.equal(database.events.size, 1);
  assert.equal(database.subscriptionMutations, 1);
});

test("transaction failure and unknown subscription roll back event reservation", async () => {
  const event = validatedEvent("evt_retryable", "subscription.activated", 1_800_000_030);
  const database = new FakeWebhookDatabase();
  database.failNextLock = true;
  await assert.rejects(processValidatedSubscriptionEvent(event, database));
  assert.equal(database.events.size, 0);
  assert.equal(database.subscriptionMutations, 0);
  assert.equal(await processValidatedSubscriptionEvent(event, database), "processed");

  const unknown = new FakeWebhookDatabase(null);
  await assert.rejects(processValidatedSubscriptionEvent(event, unknown));
  assert.equal(unknown.events.size, 0);
});

test("different concurrent events serialize and preserve timestamp order", async () => {
  const database = new FakeWebhookDatabase();
  const newer = validatedEvent("evt_newer", "subscription.activated", 1_800_000_050);
  const older = validatedEvent("evt_older", "subscription.pending", 1_800_000_040);
  const results = await Promise.all([
    processValidatedSubscriptionEvent(newer, database),
    processValidatedSubscriptionEvent(older, database),
  ]);
  assert.deepEqual(results, ["processed", "ignored_stale"]);
  assert.equal(database.subscription.status, "active");
  assert.equal(database.subscriptionMutations, 1);
  assert.equal(database.events.get("evt_older").outcome, "ignored_stale");
  assert.equal(database.locks, 2);
});

test("pre-database security rejections preserve status codes", async () => {
  const secret = "local-test-secret";
  await withWebhookSecret(secret, async () => {
    const oversized = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "content-length": String(256 * 1024 + 1) },
      body: "{}",
    }));
    assert.equal(oversized.status, 413);

    const invalidSignature = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "x-razorpay-signature": "invalid" },
      body: "{}",
    }));
    assert.equal(invalidSignature.status, 401);

    const malformedBody = "{";
    const malformed = await handleWebhook(signedRequest(malformedBody, secret));
    assert.equal(malformed.status, 400);

    const missingEventIdBody = JSON.stringify(supportedEvent());
    const missingEventId = await handleWebhook(signedRequest(missingEventIdBody, secret));
    assert.equal(missingEventId.status, 400);

    const badTimestampBody = JSON.stringify(supportedEvent({ created_at: null }));
    const badTimestamp = await handleWebhook(signedRequest(badTimestampBody, secret, {
      "x-razorpay-event-id": "evt_bad_timestamp",
    }));
    assert.equal(badTimestamp.status, 400);
  });

  await withWebhookSecret(undefined, async () => {
    const unavailable = await handleWebhook(new Request("https://example.test/webhook", {
      method: "POST",
      body: "{}",
    }));
    assert.equal(unavailable.status, 503);
  });
});

test("event ledger is bounded, append-only in purpose, and contains no payload data", async () => {
  const schema = await source("app/db/schema.ts");
  const migration = await source("drizzle/0011_add-razorpay-webhook-events.sql");
  for (const contents of [schema, migration]) {
    assert.match(contents, /razorpay_webhook_events/);
    assert.match(contents, /provider_event_id/);
    assert.match(contents, /provider_created_at/);
    assert.match(contents, /processed_at/);
    assert.match(contents, /outcome/);
    assert.doesNotMatch(contents, /raw_body|signature|webhook_secret|payment_id|customer_email|phone|card/);
  }
  assert.match(migration, /provider_event_id" varchar\(200\) PRIMARY KEY/);
});

test("duplicate reservation and subscription serialization use PostgreSQL transaction guarantees", async () => {
  const contents = await source("app/api/billing/webhook/route.ts");
  const transactionStart = contents.indexOf("database.transaction");
  const reservation = contents.indexOf("onConflictDoNothing", transactionStart);
  const lock = contents.indexOf("pg_advisory_xact_lock", reservation);
  const subscriptionRead = contents.indexOf(".select({ status: subscriptions.status })", lock);
  const subscriptionUpdate = contents.indexOf(".update(subscriptions)", subscriptionRead);
  const completion = contents.indexOf(".update(razorpayWebhookEvents)", subscriptionUpdate);
  assert.ok(transactionStart >= 0 && reservation > transactionStart);
  assert.ok(lock > reservation);
  assert.ok(subscriptionRead > lock);
  assert.ok(subscriptionUpdate > subscriptionRead);
  assert.ok(completion > subscriptionUpdate);
  assert.match(contents, /reserved\.length === 0/);
  assert.match(contents, /duplicate: true/);
});

test("unknown subscriptions and database failures roll back before generic retry response", async () => {
  const contents = await source("app/api/billing/webhook/route.ts");
  const transactionStart = contents.indexOf("database.transaction");
  const unknownThrow = contents.indexOf("throw new UnknownSubscriptionError", transactionStart);
  const catchStart = contents.indexOf("} catch {", unknownThrow);
  assert.ok(transactionStart >= 0 && unknownThrow > transactionStart && catchStart > unknownThrow);
  assert.match(contents.slice(catchStart), /Webhook processing unavailable/);
  assert.match(contents.slice(catchStart), /status: 503/);
});

test("webhook processing introduces no sensitive logging", async () => {
  const contents = await source("app/api/billing/webhook/route.ts");
  assert.doesNotMatch(contents, /console\.(?:log|info|warn|error|debug)/);
  assert.doesNotMatch(contents, /JSON\.stringify\(event|rawBody\.toString.*console/);
});
