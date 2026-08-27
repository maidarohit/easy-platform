import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINISH_SALES_PROJECT_ID,
  FINISH_SALES_RUN_ID,
  handleFinishSalesValidation,
  validateSalesOnlyState,
} from "../../app/api/internal/easy-mode/finish-sales-once/route.ts";

const modules = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"];
const tasks = modules.map((moduleId, position) => ({ moduleId, position, status: moduleId === "sales" ? "queued" : "completed" }));
const run = { id: FINISH_SALES_RUN_ID, projectId: FINISH_SALES_PROJECT_ID, userId: "boss-owner", status: "running" };
const request = new Request("https://example.invalid/api/internal/easy-mode/finish-sales-once");

test("fixed run passes only when six tasks are complete and Sales alone is queued", () => {
  assert.deepEqual(validateSalesOnlyState(run, tasks, "boss-owner"), {
    valid: true, projectId: FINISH_SALES_PROJECT_ID, runId: FINISH_SALES_RUN_ID,
    runStatus: "running", salesStatus: "queued", completedTasks: 6, providerCallsOnRun: 1,
  });
});

test("wrong project, run, owner, or run status fails validation", () => {
  assert.equal(validateSalesOnlyState({ ...run, projectId: "wrong" }, tasks, "boss-owner"), null);
  assert.equal(validateSalesOnlyState({ ...run, id: "wrong" }, tasks, "boss-owner"), null);
  assert.equal(validateSalesOnlyState(run, tasks, "another-user"), null);
  assert.equal(validateSalesOnlyState({ ...run, status: "completed" }, tasks, "boss-owner"), null);
});

test("unexpected queued or running module prevents Sales execution", () => {
  for (const status of ["queued", "running", "failed", "skipped"]) {
    const changed = tasks.map((task) => task.moduleId === "uiux" ? { ...task, status } : task);
    assert.equal(validateSalesOnlyState(run, changed, "boss-owner"), null, status);
  }
});

test("Sales must be the unique seventh queued task", () => {
  assert.equal(validateSalesOnlyState(run, tasks.map((task) => task.moduleId === "sales" ? { ...task, status: "completed" } : task), "boss-owner"), null);
  assert.equal(validateSalesOnlyState(run, tasks.slice(0, 6), "boss-owner"), null);
  assert.equal(validateSalesOnlyState(run, [...tasks, { moduleId: "sales", position: 7, status: "queued" }], "boss-owner"), null);
});

test("validation endpoint requires authenticated boss who owns the run", async () => {
  const read = async () => ({ run, tasks });
  assert.equal((await handleFinishSalesValidation(request, { verify: async () => { throw new Error("no"); }, isBoss: () => false, read })).status, 404);
  assert.equal((await handleFinishSalesValidation(request, { verify: async () => ({ uid: "boss-owner" }), isBoss: () => false, read })).status, 404);
  const response = await handleFinishSalesValidation(request, { verify: async () => ({ uid: "boss-owner" }), isBoss: () => true, read });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).salesStatus, "queued");
});

test("boss page sends exactly one existing-run execute-next request with an empty body", async () => {
  const page = await readFile("app/boss/finish-sales-once/page.tsx", "utf8");
  assert.match(page, /319cbe1c-efa0-4288-b644-48fd92b48b9e/);
  assert.match(page, /authenticatedFetch\(EXECUTE_ENDPOINT/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /body: JSON\.stringify\(\{\}\)/);
  assert.doesNotMatch(page, /\/api\/business-build/);
  assert.equal((page.match(/authenticatedFetch\(EXECUTE_ENDPOINT/g) ?? []).length, 1);
});

test("synchronous guards prevent double click and require fresh successful validation", async () => {
  const page = await readFile("app/boss/finish-sales-once/page.tsx", "utf8");
  assert.match(page, /if \(inFlight\.current \|\| salesRequestSent\.current \|\| !validation\?\.valid\) return/);
  assert.match(page, /inFlight\.current = true;\s*salesRequestSent\.current = true/);
  assert.match(page, /setSalesAttempted\(true\)/);
  assert.match(page, /disabled=\{busy \|\| !validation\?\.valid \|\| salesAttempted\}/);
});

test("validation is read-only and page contains no provider or new-build path", async () => {
  const [route, page] = await Promise.all([
    readFile("app/api/internal/easy-mode/finish-sales-once/route.ts", "utf8"),
    readFile("app/boss/finish-sales-once/page.tsx", "utf8"),
  ]);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /isBossAdmin/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|executeEasyModeRun|executeNextEasyModeTask|fetch\s*\(|OPENAI|N8N_/i);
  assert.doesNotMatch(page, /OPENAI|N8N_|\/api\/business-build|crypto\.randomUUID/i);
});
