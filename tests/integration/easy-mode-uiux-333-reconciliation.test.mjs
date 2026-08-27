import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  reconcileEasyModeUiux333,
  UIUX_333_PROJECT_ID,
  UIUX_333_PROVIDER_EXECUTION_ID,
} from "../../app/lib/easy-mode-uiux-333-reconciliation.ts";
import { handleUiux333Reconciliation } from "../../app/api/internal/easy-mode/reconcile-uiux-333/route.ts";

const response = [{ output: {
  accessibility: "Accessible controls", designSystem: "Consistent components",
  desktopExperience: "Clear desktop experience", microInteractions: "Useful feedback",
  mobileExperience: "Responsive mobile experience", uiuxStrategy: "Customer-first strategy",
  userFlow: "Discovery to enquiry", userPersonas: "Primary customer personas", wireframes: "Core page wireframes",
} }];
const input = { projectId: UIUX_333_PROJECT_ID, executionId: UIUX_333_PROVIDER_EXECUTION_ID, response, dryRun: true };
const request = (body) => new Request("https://example.invalid/api/internal/easy-mode/reconcile-uiux-333", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

test("correct project, execution and validated UIUX result are accepted", async () => {
  let writes = 0;
  const result = await reconcileEasyModeUiux333(input, async (output, dryRun) => {
    writes += 1;
    assert.equal(output.uiuxStrategy, "Customer-first strategy");
    assert.equal(dryRun, true);
    return { state: "validated", runId: "run", taskId: "task", attemptId: "attempt", usageId: "usage", outputId: null, salesStatus: "queued" };
  });
  assert.equal(result.state, "validated");
  assert.equal(result.salesStatus, "queued");
  assert.equal(writes, 1);
});

test("wrong project is rejected before persistence", async () => {
  let called = false;
  await assert.rejects(() => reconcileEasyModeUiux333({ ...input, projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, async () => { called = true; throw new Error(); }));
  assert.equal(called, false);
});

test("wrong provider execution is rejected before persistence", async () => {
  await assert.rejects(() => reconcileEasyModeUiux333({ ...input, executionId: "334" }));
});

test("malformed UIUX JSON is rejected", async () => {
  await assert.rejects(() => reconcileEasyModeUiux333({ ...input, response: { uiuxStrategy: "incomplete" } }));
});

test("duplicate reconciliation and already-completed state are idempotent", async () => {
  const state = { outputCount: 0, completed: false, usageCount: 1 };
  const writer = async () => {
    if (state.completed) return { state: "already_reconciled", runId: "run", taskId: "task", attemptId: "attempt", usageId: "usage", outputId: "output", salesStatus: "queued" };
    state.outputCount += 1; state.completed = true;
    return { state: "reconciled", runId: "run", taskId: "task", attemptId: "attempt", usageId: "usage", outputId: "output", salesStatus: "queued" };
  };
  assert.equal((await reconcileEasyModeUiux333({ ...input, dryRun: false }, writer)).state, "reconciled");
  assert.equal((await reconcileEasyModeUiux333({ ...input, dryRun: false }, writer)).state, "already_reconciled");
  assert.equal(state.outputCount, 1);
  assert.equal(state.usageCount, 1);
});

test("route requires boss authentication and fixed identifiers", async () => {
  const never = async () => { throw new Error("must not reconcile"); };
  const noAuth = { verify: async () => { throw new Error("no"); }, isBoss: () => false };
  const ordinary = { verify: async () => ({ uid: "user" }), isBoss: () => false };
  assert.equal((await handleUiux333Reconciliation(request(input), never, noAuth)).status, 404);
  assert.equal((await handleUiux333Reconciliation(request(input), never, ordinary)).status, 404);
  const boss = { verify: async () => ({ uid: "boss" }), isBoss: () => true };
  assert.equal((await handleUiux333Reconciliation(request({ ...input, executionId: "334" }), never, boss)).status, 400);
});

test("dry run reaches validation without requesting mutation mode", async () => {
  const boss = { verify: async () => ({ uid: "boss" }), isBoss: () => true };
  const reconcile = async (received) => {
    assert.equal(received.dryRun, true);
    return { state: "validated", runId: "run", taskId: "task", attemptId: "attempt", usageId: "usage", outputId: null, salesStatus: "queued" };
  };
  const result = await handleUiux333Reconciliation(request(input), reconcile, boss);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).state, "validated");
});

test("production mechanism reuses usage, preserves Sales, and cannot call providers or runners", async () => {
  const [service, route] = await Promise.all([
    readFile("app/lib/easy-mode-uiux-333-reconciliation.ts", "utf8"),
    readFile("app/api/internal/easy-mode/reconcile-uiux-333/route.ts", "utf8"),
  ]);
  assert.match(service, /eq\(easyModeTasks\.moduleId, "uiux"\)/);
  assert.match(service, /run\.status !== "running"/);
  assert.match(service, /task\.status !== "running"/);
  assert.match(service, /task\.projectOutputId/);
  assert.match(service, /sales\.status !== "queued"/);
  assert.match(service, /eq\(aiUsage\.id, attempt\.usageId\)/);
  assert.match(service, /update\(aiUsage\)/);
  assert.doesNotMatch(service, /insert\(aiUsage\)|startAiUsage|claimIdempotentAiUsage/);
  assert.match(service, /already_reconciled/);
  assert.match(service, /if \(dryRun\)/);
  assert.match(service, /Customer experience:/);
  assert.match(service, /salesAfter\?\.status !== "queued"/);
  assert.doesNotMatch(`${service}\n${route}`, /\bfetch\s*\(|executeEasyModeRun|executeNextEasyModeTask|executeTextSpecialistService|N8N_|OPENAI|sales-ai/i);
});
