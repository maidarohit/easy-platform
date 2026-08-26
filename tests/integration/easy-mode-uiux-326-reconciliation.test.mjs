import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateUiuxOutput } from "../../app/lib/easy-mode-execution-contracts.ts";
import { reconcileEasyModeUiux326 } from "../../app/lib/easy-mode-uiux-326-reconciliation.ts";

const requiredFields = [
  "accessibility", "designSystem", "desktopExperience", "microInteractions", "mobileExperience",
  "uiuxStrategy", "userFlow", "userPersonas", "wireframes",
];
const canonical = Object.fromEntries(requiredFields.map((field) => [field, `${field} result`]));

test("canonical UIUX output remains valid", () => {
  assert.deepEqual(validateUiuxOutput(canonical), canonical);
});

test("UIUX designRecommendations is a strict optional string", () => {
  const output = { ...canonical, designRecommendations: "Prioritized design improvements" };
  assert.deepEqual(validateUiuxOutput(output), output);
  assert.equal(validateUiuxOutput({ ...output, unknownField: "no" }), null);
  assert.equal(validateUiuxOutput(Object.fromEntries(Object.entries(output).filter(([key]) => key !== "wireframes"))), null);
  assert.equal(validateUiuxOutput({ ...canonical, designRecommendations: 42 }), null);
  assert.equal(validateUiuxOutput({ ...canonical, designRecommendations: "x".repeat(20_001) }), null);
});

test("UIUX #326 wrapper validates before its injected writer and remains idempotent", async () => {
  const response = [{ output: { ...canonical, designRecommendations: "MVP recommendations" } }];
  const state = { writes: 0, completed: false };
  const writer = async (output) => {
    assert.equal(output.designRecommendations, "MVP recommendations");
    if (state.completed) return { state: "already_reconciled", outputId: "output-326", usageId: "usage-326", nextModule: "sales" };
    state.writes += 1;
    state.completed = true;
    return { state: "reconciled", outputId: "output-326", usageId: "usage-326", nextModule: "sales" };
  };
  assert.equal((await reconcileEasyModeUiux326(response, writer)).state, "reconciled");
  assert.equal((await reconcileEasyModeUiux326(response, writer)).state, "already_reconciled");
  assert.equal(state.writes, 1);
  await assert.rejects(() => reconcileEasyModeUiux326([{ output: { ...canonical, extra: "no" } }], writer));
});

test("fixed reconciliation preserves usage accounting and cannot dispatch work", async () => {
  const reconciliation = await readFile(new URL("../../app/lib/easy-mode-uiux-326-reconciliation.ts", import.meta.url), "utf8");
  const cli = await readFile(new URL("../../scripts/reconcile-uiux-326.mjs", import.meta.url), "utf8");
  assert.match(reconciliation, /0882c7a2-490b-4837-ab21-3ea1a4ba83e3/);
  assert.match(reconciliation, /39012ee0-6fea-4841-b99f-793727a045a1/);
  assert.match(reconciliation, /4e159131-0da3-46e7-96e4-5e28cd982df4/);
  assert.match(reconciliation, /failed_uncertain/);
  assert.match(reconciliation, /DELIVERY_UNCERTAIN/);
  assert.match(reconciliation, /already_reconciled/);
  assert.match(reconciliation, /update\(aiUsage\)\.set\(\{ status: "success" \}\)/);
  assert.doesNotMatch(reconciliation, /insert\(aiUsage\)|requestCount:|inputTokens:|outputTokens:|estimatedCostUsd:/);
  assert.doesNotMatch(`${reconciliation}\n${cli}`, /\bfetch\s*\(|executeEasyModeRun|executeNextEasyModeTask|N8N_|OPENAI|sales-ai/i);
});
