import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isTestProjectLimitBypassUser, projectCountAllowance } from "../../app/lib/paid-entitlements.ts";

function withTestAllowlist(value, callback) {
  const previous = process.env.PRIVATE_BETA_UIDS_TEST;
  process.env.PRIVATE_BETA_UIDS_TEST = value;
  try { callback(); } finally {
    if (previous === undefined) delete process.env.PRIVATE_BETA_UIDS_TEST;
    else process.env.PRIVATE_BETA_UIDS_TEST = previous;
  }
}

test("1 normal non-test user still hits the Pro project limit", () => withTestAllowlist("test-uid", () => {
  assert.deepEqual(projectCountAllowance({ userId: "normal-uid", plan: "pro", used: 3, limit: 3 }), {
    ok: false, reason: "PLAN_LIMIT_REACHED", category: "projects", used: 3, limit: 3,
  });
}));

test("2 paid customer project-limit behavior remains unchanged", () => withTestAllowlist("test-uid", () => {
  assert.equal(projectCountAllowance({ userId: "paid-uid", plan: "business", used: 9, limit: 10 }).ok, true);
  assert.equal(projectCountAllowance({ userId: "paid-uid", plan: "business", used: 10, limit: 10 }).ok, false);
}));

test("3 allowlisted test UID can create beyond the configured project limit", () => withTestAllowlist(" test-uid , another-test ", () => {
  const result = projectCountAllowance({ userId: "test-uid", plan: "pro", used: 25, limit: 3 });
  assert.equal(result.ok, true); assert.equal("testLimitBypass" in result, true);
}));

test("4 non-allowlisted UID cannot bypass", () => withTestAllowlist("test-uid", () => {
  assert.equal(isTestProjectLimitBypassUser("attacker"), false);
  assert.equal(projectCountAllowance({ userId: "attacker", plan: "pro", used: 4, limit: 3 }).ok, false);
}));

test("5 project creation remains provider-free and trusts verified server UID", async () => {
  const source = await readFile("app/api/projects/route.ts", "utf8");
  assert.match(source, /verifyFirebaseIdToken\(req\)\)\.uid/);
  assert.doesNotMatch(source, /OPENAI|GEMINI|N8N_|startAiUsage|requestBusinessIntakeAnalysis|body\.userId/i);
});

test("6 project creation cannot start Easy Mode", async () => {
  const source = await readFile("app/api/projects/route.ts", "utf8");
  assert.doesNotMatch(source, /executeEasyMode|easyModeRuns|\/api\/easy-mode/);
});

test("BOSS_ADMIN_UIDS_TEST does not grant the project-limit bypass", () => {
  const previousBosses = process.env.BOSS_ADMIN_UIDS_TEST;
  const previousTests = process.env.PRIVATE_BETA_UIDS_TEST;
  process.env.BOSS_ADMIN_UIDS_TEST = "boss-only";
  delete process.env.PRIVATE_BETA_UIDS_TEST;
  try { assert.equal(isTestProjectLimitBypassUser("boss-only"), false); }
  finally {
    if (previousBosses === undefined) delete process.env.BOSS_ADMIN_UIDS_TEST; else process.env.BOSS_ADMIN_UIDS_TEST = previousBosses;
    if (previousTests === undefined) delete process.env.PRIVATE_BETA_UIDS_TEST; else process.env.PRIVATE_BETA_UIDS_TEST = previousTests;
  }
});
