import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { persistSuccessfulFreeWebsitePreview } from "../../app/lib/free-website-preview.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("first successful unpaid website preview is persisted and consumes its claim", async () => {
  const calls = [];
  const claim = { token: "11111111-1111-4111-8111-111111111111", projectId: "owned-project" };
  const saved = await persistSuccessfulFreeWebsitePreview("owner", claim, '{"website":"ready"}', {
    save: async (...args) => { calls.push(args); return true; },
    release: async () => assert.fail("successful preview must not be released"),
  });
  assert.equal(saved, true);
  assert.deepEqual(calls, [["owner", claim, '{"website":"ready"}']]);
});

test("failed output persistence releases the claim so a failed generation is not consumed", async () => {
  const released = [];
  const claim = { token: "22222222-2222-4222-8222-222222222222", projectId: "owned-project" };
  await assert.rejects(persistSuccessfulFreeWebsitePreview("owner", claim, "{}", {
    save: async () => { throw new Error("database unavailable"); },
    release: async (...args) => { released.push(args); },
  }), /database unavailable/);
  assert.deepEqual(released, [["owner", claim]]);
});

test("durable claim schema makes the second and concurrent request ineligible", async () => {
  const [schema, migration, service] = await Promise.all([
    source("app/db/schema.ts"), source("drizzle/0027_add-free-website-previews.sql"), source("app/lib/free-website-preview.ts"),
  ]);
  assert.match(schema, /free_website_previews_user_unique/);
  assert.match(migration, /UNIQUE INDEX[\s\S]*user_id/i);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /existing\?\.status === "used"/);
  assert.match(service, /existing\?\.status === "claimed"/);
  assert.match(service, /savedWebsite[\s\S]*return null/);
});

test("free claim is owner-scoped and successful output plus used state are atomic", async () => {
  const service = await source("app/lib/free-website-preview.ts");
  assert.match(service, /eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)/);
  assert.match(service, /return undefined/);
  assert.match(service, /transaction\.insert\(projectOutputs\)/);
  assert.match(service, /status: "used", usedAt: now/);
});

test("Website AI grants only subscription-denied users the free path and leaves paid usage unchanged", async () => {
  const route = await source("app/api/website-ai/route.ts");
  assert.match(route, /checkUsageAllowance\(uid, "websiteGenerations"\)/);
  assert.match(route, /if \(allowance\.ok\)[\s\S]*startAiUsage/);
  assert.match(route, /allowance\.reason === "PAID_SUBSCRIPTION_REQUIRED"[\s\S]*claimFreeWebsitePreview/);
  assert.match(route, /if \(!claim\) return allowanceError\(allowance\)/);
  assert.match(route, /releaseFreeWebsitePreview/);
  assert.match(route, /persistSuccessfulFreeWebsitePreview/);
});

test("viewing remains free while publishing remains paid-only", async () => {
  const [outputs, publication, entitlements] = await Promise.all([
    source("app/api/project-outputs/route.ts"), source("app/api/business-publications/route.ts"), source("app/lib/paid-entitlements.ts"),
  ]);
  assert.match(outputs, /export async function GET/);
  assert.doesNotMatch(outputs.slice(outputs.indexOf("export async function GET")), /requirePaidProductAccess/);
  assert.match(publication, /requirePaidProductAccess/);
  assert.match(entitlements, /module: string[\s\S]*categoryForModule\(module\)/);
});
