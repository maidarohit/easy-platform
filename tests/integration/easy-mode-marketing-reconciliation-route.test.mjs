import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleMarketing320Reconciliation } from "../../app/api/internal/easy-mode/reconcile-marketing-320/route.ts";

const secret = "test-reconciliation-secret";
const identifiers = {
  runId: "5b327c31-dc34-4a37-aea8-3aef107a828e",
  projectId: "5e56706a-41e9-498b-bf8a-134fffc8c06f",
  executionKey: "74bb8691-4566-4c00-9c48-c6853a4d81f8",
};
const response = [{ output: { marker: "mocked; production normalizer is tested separately" } }];
const request = (body, authorization = `Bearer ${secret}`) => new Request(
  "https://example.invalid/api/internal/easy-mode/reconcile-marketing-320",
  { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(body) },
);

test("temporary Marketing route reuses internal secret auth and accepts only the fixed identifiers", async () => {
  const previous = process.env.AI_USAGE_RECONCILIATION_SECRET;
  process.env.AI_USAGE_RECONCILIATION_SECRET = secret;
  let calls = 0;
  const reconcile = async (input) => {
    calls += 1;
    assert.deepEqual(input, { ...identifiers, response });
    return { state: "reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" };
  };
  try {
    const unauthorized = await handleMarketing320Reconciliation(request({ ...identifiers, response }, "Bearer wrong"), reconcile);
    assert.equal(unauthorized.status, 404);
    const wrongRun = await handleMarketing320Reconciliation(request({ ...identifiers, runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", response }), reconcile);
    assert.equal(wrongRun.status, 400);
    const valid = await handleMarketing320Reconciliation(request({ ...identifiers, response }), reconcile);
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { state: "reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" });
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.AI_USAGE_RECONCILIATION_SECRET;
    else process.env.AI_USAGE_RECONCILIATION_SECRET = previous;
  }
});

test("temporary route is Node-only, bounded, provider-free, and cannot create usage or replay tasks", async () => {
  const route = await readFile(new URL("../../app/api/internal/easy-mode/reconcile-marketing-320/route.ts", import.meta.url), "utf8");
  const script = await readFile(new URL("../../scripts/reconcile-marketing-320.mjs", import.meta.url), "utf8");
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /AI_USAGE_RECONCILIATION_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /256 \* 1024/);
  assert.match(script, /https:\/\/www\.buzypeezy\.ai\/api\/internal\/easy-mode\/reconcile-marketing-320/);
  assert.doesNotMatch(route, /startAiUsage|insert\(aiUsage\)|executeEasyModeRun|executeNextEasyModeTask|N8N_|OPENAI|fetch\s*\(/i);
});
