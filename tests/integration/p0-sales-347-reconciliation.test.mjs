import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleSales347Reconciliation } from "../../app/api/internal/easy-mode/reconcile-sales-347/route.ts";
import {
  SALES_347_EXECUTION_ID, SALES_347_PROJECT_ID, SALES_347_RUN_ID, SALES_347_TASK_ID, SALES_347_USAGE_ID,
  validateSales347Execution,
} from "../../app/lib/easy-mode-sales-347-reconciliation.ts";
import { derivePersistedEasyModeRunStatus } from "../../app/lib/easy-mode-task-attempts.ts";

const workflowId = "sales-workflow";
const salesOutput = {
  executiveSummary: "Sales plan", targetCustomerProfile: "Owners", salesFunnel: "Awareness to close",
  leadGenerationStrategy: "Referrals", salesChannels: "Direct", outreachStrategy: "Email",
  pricingRecommendations: "Value based", salesKPIs: "Conversion", actionPlan: "Launch",
  salesScript: "Opening", proposal: "Proposal", closingStrategy: "Follow up",
};
const execution = {
  id: SALES_347_EXECUTION_ID, status: "success", workflowId,
  startedAt: "2026-08-28T10:00:00.000Z", stoppedAt: "2026-08-28T10:00:12.000Z",
  data: { resultData: { runData: { "Respond to Webhook": [{ data: { main: [[{ json: {
    projectId: SALES_347_PROJECT_ID, runId: SALES_347_RUN_ID, taskId: SALES_347_TASK_ID,
    usageId: SALES_347_USAGE_ID, output: salesOutput,
  } }]] } }] } } },
};
const withRespondJson = (json, overrides = {}) => ({
  ...execution,
  ...overrides,
  data: { resultData: { runData: {
    ...(overrides.runData ?? {}),
    "Respond to Webhook": [{ data: { main: [[{ json }]] } }],
  } } },
});
const fixedBody = {
  projectId: SALES_347_PROJECT_ID, runId: SALES_347_RUN_ID, taskId: SALES_347_TASK_ID,
  usageId: SALES_347_USAGE_ID, executionId: SALES_347_EXECUTION_ID,
};
const request = (body) => new Request("https://example.invalid/internal", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fake" },
  body: JSON.stringify(body),
});
const boss = { verify: async () => ({ uid: "boss" }), isBoss: () => true };

test("valid Sales output directly in Respond to Webhook JSON is accepted", () => {
  const validated = validateSales347Execution(execution, workflowId);
  assert.deepEqual(validated?.output, salesOutput);
  assert.equal(validated?.durationMs, 12_000);
});

test("valid Sales output nested in Respond to Webhook JSON is accepted", () => {
  const validated = validateSales347Execution(withRespondJson({ response: { body: { output: salesOutput } } }), workflowId);
  assert.deepEqual(validated?.output, salesOutput);
});

test("identical duplicate Sales output wrappers are accepted as one unique output", () => {
  const validated = validateSales347Execution(withRespondJson({
    response: { output: salesOutput },
    body: { nested: { output: { ...salesOutput } } },
  }), workflowId);
  assert.deepEqual(validated?.output, salesOutput);
});

test("two different Sales outputs in Respond to Webhook JSON are rejected", () => {
  const differentOutput = { ...salesOutput, executiveSummary: "Different Sales plan" };
  assert.equal(validateSales347Execution(withRespondJson({
    response: { output: salesOutput }, body: { output: differentOutput },
  }), workflowId), null);
});

test("Sales output only in AI Agent data is rejected", () => {
  const onlyAgentOutput = withRespondJson({ response: { ok: true } }, {
    runData: { "AI Agent": [{ data: { main: [[{ json: { output: salesOutput } }]] } }] },
  });
  assert.equal(validateSales347Execution(onlyAgentOutput, workflowId), null);
});

test("wrong execution ID, workflow ID, and unsuccessful status are rejected", () => {
  assert.equal(validateSales347Execution({ ...execution, id: "348" }, workflowId), null);
  assert.equal(validateSales347Execution({ ...execution, status: "running" }, workflowId), null);
  assert.equal(validateSales347Execution({ ...execution, workflowId: "other" }, workflowId), null);
});

test("conflicting project, run, task, or usage metadata is rejected", () => {
  for (const [key, value] of [
    ["projectId", "wrong-project"], ["runId", "wrong-run"],
    ["taskId", "wrong-task"], ["usageId", "wrong-usage"],
  ]) {
    assert.equal(validateSales347Execution(withRespondJson({
      [key]: value, output: salesOutput,
    }), workflowId), null, key);
  }
});

test("boss validation is read-only and uses only the fetched saved execution", async () => {
  let validations = 0;
  let applies = 0;
  const response = await handleSales347Reconciliation(request({ ...fixedBody, action: "validate" }), {
    ...boss,
    fetchExecution: async () => ({ output: salesOutput, durationMs: 12_000 }),
    validate: async () => { validations += 1; return { state: "validated", outputId: null, salesTaskStatus: "running", runStatus: "running" }; },
    apply: async () => { applies += 1; throw new Error("must not apply"); },
  });
  assert.equal(response.status, 200);
  assert.equal(validations, 1);
  assert.equal(applies, 0);
});

test("wrong fixed execution or usage identifiers are blocked before execution lookup", async () => {
  let fetches = 0;
  const dependencies = {
    ...boss, fetchExecution: async () => { fetches += 1; throw new Error("unexpected"); },
    validate: async () => assert.fail("unexpected"), apply: async () => assert.fail("unexpected"),
  };
  assert.equal((await handleSales347Reconciliation(request({ ...fixedBody, executionId: "348", action: "validate" }), dependencies)).status, 400);
  assert.equal((await handleSales347Reconciliation(request({ ...fixedBody, usageId: "wrong", action: "validate" }), dependencies)).status, 400);
  assert.equal(fetches, 0);
});

test("double reconcile invocation persists at most one output and then reports already reconciled", async () => {
  let persisted = false;
  let inserts = 0;
  const apply = async () => {
    if (persisted) return { state: "already_reconciled", outputId: "output-1", salesTaskStatus: "completed", runStatus: "completed" };
    persisted = true; inserts += 1;
    return { state: "reconciled", outputId: "output-1", salesTaskStatus: "completed", runStatus: "completed" };
  };
  const dependencies = {
    ...boss, fetchExecution: async () => ({ output: salesOutput, durationMs: 12_000 }),
    validate: async () => assert.fail("unexpected"), apply,
  };
  const [first, second] = await Promise.all([
    handleSales347Reconciliation(request({ ...fixedBody, action: "reconcile" }), dependencies),
    handleSales347Reconciliation(request({ ...fixedBody, action: "reconcile" }), dependencies),
  ]);
  assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(inserts, 1);
});

test("run completion requires seven module-matched persisted outputs", () => {
  const tasks = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"]
    .map((moduleId) => ({ status: "completed", projectOutputId: `output-${moduleId}` }));
  assert.equal(derivePersistedEasyModeRunStatus(tasks), "completed");
  assert.equal(derivePersistedEasyModeRunStatus(tasks.map((task, index) => index === 6 ? { ...task, projectOutputId: null } : task)), "partially_completed");
});

test("implementation is fixed-ID, row-locked, idempotent, and trigger-free", async () => {
  const [service, route, page] = await Promise.all([
    readFile(new URL("../../app/lib/easy-mode-sales-347-reconciliation.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/internal/easy-mode/reconcile-sales-347/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/boss/reconcile-sales-347/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(service, /for\("update"\)/);
  assert.match(service, /already_reconciled/);
  assert.match(service, /insert\(projectOutputs\)/);
  assert.match(service, /derivePersistedEasyModeRunStatus/);
  assert.match(route, /isBossAdmin/);
  assert.match(page, /Validate Sales reconciliation/);
  assert.match(page, /Reconcile Sales 347/);
  assert.doesNotMatch(`${service}\n${route}`, /executeTextSpecialistService|startAiUsage|claimNextEasyModeTask|N8N_SALES_AI_WEBHOOK_URL|api\.openai\.com/);
});
