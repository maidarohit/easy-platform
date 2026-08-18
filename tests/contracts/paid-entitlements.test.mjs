import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("all tracked AI requests are checked before a usage row/provider call", async () => {
  const contents = await source("app/lib/ai-usage.ts");
  const guard = contents.indexOf("requirePaidModule(userId, module)");
  const insert = contents.indexOf(".insert(aiUsage)");
  assert.ok(guard >= 0 && guard < insert);
  assert.match(contents, /throw access\.response/);
  assert.match(contents, /pg_advisory_xact_lock/);
});

test("public Business Idea usage is not routed through the paid ledger guard", async () => {
  const contents = await source("app/api/business-ideas/route.ts");
  assert.doesNotMatch(contents, /startAiUsage|requirePaidEntitlement|requirePaidModule/);
});

test("allowances are server-side placeholders with no client-controlled plan", async () => {
  const config = await source("app/lib/plan-config.ts");
  const guard = await source("app/lib/paid-entitlements.ts");
  assert.match(config, /NON-COMMERCIAL PLACEHOLDERS/);
  assert.match(config, /pro:/);
  assert.match(config, /business:/);
  assert.match(guard, /subscription\.status !== "active"/);
  assert.doesNotMatch(guard, /request\.json|searchParams/);
});

test("terminal subscription states cannot receive paid access", async () => {
  const contents = await source("app/lib/subscription-policy.ts");
  assert.match(contents, /return status === "active"/);
});

test("Boss overrides require verified UID and server allowlist", async () => {
  const route = await source("app/api/internal/boss/entitlements/route.ts");
  const guard = await source("app/lib/paid-entitlements.ts");
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /isBossAdmin\(token\.uid\)/);
  assert.match(route, /status: 404/);
  assert.match(guard, /BOSS_ADMIN_UIDS/);
});

test("emergency switches cover expensive and orchestrated categories", async () => {
  const contents = await source("app/lib/paid-entitlements.ts");
  for (const name of ["PAID_AI_GENERATION_ENABLED", "PAID_IMAGE_AI_ENABLED", "PAID_VIDEO_AI_ENABLED", "PAID_AI_MANAGER_ENABLED", "PAID_AUTOMATION_ENABLED"]) {
    assert.ok(contents.includes(name), `${name} is missing`);
  }
});

test("automation authorization applies its limit before route provider calls", async () => {
  const contents = await source("app/lib/automation-auth.ts");
  assert.match(contents, /requirePaidEntitlement\(userId, "automationRuns"\)/);
});
