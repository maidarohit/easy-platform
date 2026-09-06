import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { announceSubscriptionRequired, isSubscriptionRequiredResponse, SUBSCRIPTION_REQUIRED_EVENT } from "../../app/lib/subscription-required.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("only the authoritative subscription-required response opens the upgrade experience", async () => {
  assert.equal(await isSubscriptionRequiredResponse(Response.json({ code: "PAID_SUBSCRIPTION_REQUIRED" }, { status: 403 })), true);
  assert.equal(await isSubscriptionRequiredResponse(Response.json({ code: "PLAN_LIMIT_REACHED" }, { status: 429 })), false);
  assert.equal(await isSubscriptionRequiredResponse(Response.json({ error: "provider failed" }, { status: 503 })), false);
});

test("authenticated paid-feature requests announce an upgrade without changing the rejected response", async () => {
  const oldWindow = globalThis.window;
  const events = [];
  globalThis.window = {
    location: { origin: "https://app.example", pathname: "/business-preview", search: "?projectId=project-1", hash: "" },
    dispatchEvent(event) { events.push(event); },
  };
  try {
    const response = Response.json({ code: "PAID_SUBSCRIPTION_REQUIRED" }, { status: 403 });
    await announceSubscriptionRequired(response, "/api/business-publications", { method: "POST", body: JSON.stringify({ projectId: "project-1" }) });
    assert.equal(response.status, 403);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, SUBSCRIPTION_REQUIRED_EVENT);
    assert.deepEqual(events[0].detail, { returnTo: "/business-preview?projectId=project-1", projectId: "project-1" });
  } finally { globalThis.window = oldWindow; }
});

test("upgrade UI uses the regional offer endpoint and preserves preview navigation", async () => {
  const [modal, billing, offer, plans, authenticatedFetch] = await Promise.all([
    source("app/components/SubscriptionUpgradeModal.tsx"), source("app/billing/page.tsx"),
    source("app/api/billing/offer/route.ts"), source("app/lib/billing-plans.ts"), source("app/lib/authenticated-fetch.ts"),
  ]);
  assert.match(modal, /Continue with Buzypeezy Business/);
  assert.match(modal, /Subscribe &amp; Continue/);
  assert.match(modal, /Keep viewing my preview/);
  assert.match(modal, /\/api\/billing\/offer/);
  assert.match(modal, /plan:\s*"business", returnTo:/);
  assert.match(billing, /billing-return-to/);
  assert.match(billing, /Continue to my business/);
  assert.match(offer, /BILLING_PLAN\.prices\[market\]/);
  assert.match(plans, /india:[\s\S]*international:/);
  assert.match(authenticatedFetch, /announceSubscriptionRequired/);
  assert.doesNotMatch(modal, /â‚¹1,999|US\$50/);
});

test("server entitlement remains authoritative and direct unpaid calls stay rejected", async () => {
  const [entitlements, executeRoute] = await Promise.all([
    source("app/lib/paid-entitlements.ts"), source("app/api/easy-mode/runs/[runId]/execute-next/route.ts"),
  ]);
  assert.match(entitlements, /status:\s*result\.reason === "PAID_SUBSCRIPTION_REQUIRED" \? 403/);
  assert.match(executeRoute, /subscription_required" \? 403/);
  assert.match(executeRoute, /code: "PAID_SUBSCRIPTION_REQUIRED"/);
});
