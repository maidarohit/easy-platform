import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleMarketing320Reconciliation } from "../../app/api/internal/easy-mode/reconcile-marketing-320/route.ts";

const identifiers = {
  runId: "5b327c31-dc34-4a37-aea8-3aef107a828e",
  projectId: "5e56706a-41e9-498b-bf8a-134fffc8c06f",
  executionKey: "74bb8691-4566-4c00-9c48-c6853a4d81f8",
};
const response = [{ output: { marker: "mocked; production normalizer is tested separately" } }];
const request = (body) => new Request(
  "https://example.invalid/api/internal/easy-mode/reconcile-marketing-320",
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
);

test("temporary Marketing route rejects unauthenticated and authenticated non-boss callers", async () => {
  const reconcile = async () => { throw new Error("must not reconcile"); };
  const unauthenticated = {
    verify: async () => { throw new Error("invalid token"); },
    isBoss: () => false,
  };
  const nonBoss = {
    verify: async () => ({ uid: "ordinary-user" }),
    isBoss: () => false,
  };
  assert.equal((await handleMarketing320Reconciliation(request({ ...identifiers, response }), reconcile, unauthenticated)).status, 404);
  assert.equal((await handleMarketing320Reconciliation(request({ ...identifiers, response }), reconcile, nonBoss)).status, 404);
});

test("authenticated boss is accepted only for the fixed identifiers", async () => {
  let calls = 0;
  const boss = { verify: async () => ({ uid: "boss-user" }), isBoss: (uid) => uid === "boss-user" };
  const reconcile = async (input) => {
    calls += 1;
    assert.deepEqual(input, { ...identifiers, response });
    return { state: "reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" };
  };
  const wrongRun = await handleMarketing320Reconciliation(request({ ...identifiers, runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", response }), reconcile, boss);
  assert.equal(wrongRun.status, 400);
  const wrongProject = await handleMarketing320Reconciliation(request({ ...identifiers, projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", response }), reconcile, boss);
  assert.equal(wrongProject.status, 400);
  const wrongExecution = await handleMarketing320Reconciliation(request({ ...identifiers, executionKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", response }), reconcile, boss);
  assert.equal(wrongExecution.status, 400);
  const valid = await handleMarketing320Reconciliation(request({ ...identifiers, response }), reconcile, boss);
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { state: "reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" });
  assert.equal(calls, 1);
});

test("temporary route is Node-only, bounded, provider-free, and cannot create usage or replay tasks", async () => {
  const route = await readFile(new URL("../../app/api/internal/easy-mode/reconcile-marketing-320/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/boss/reconcile-marketing-320/page.tsx", import.meta.url), "utf8");
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /isBossAdmin/);
  assert.doesNotMatch(route, /AI_USAGE_RECONCILIATION_SECRET|timingSafeEqual/);
  assert.match(route, /256 \* 1024/);
  assert.match(page, /authenticatedFetch\("\/api\/internal\/easy-mode\/reconcile-marketing-320"/);
  assert.doesNotMatch(route, /startAiUsage|insert\(aiUsage\)|executeEasyModeRun|executeNextEasyModeTask|N8N_|OPENAI|fetch\s*\(/i);
});
