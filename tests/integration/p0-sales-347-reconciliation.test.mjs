import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleSales347Reconciliation } from "../../app/api/internal/easy-mode/reconcile-sales-347/route.ts";
import {
  SALES_347_EXECUTION_ID, SALES_347_PROJECT_ID, SALES_347_RUN_ID, SALES_347_TASK_ID, SALES_347_USAGE_ID,
  SALES_347_WORKFLOW_ID, validateSales347ExecutionMetadata, validateSales347Output,
  verifySales347ExecutionMetadata,
} from "../../app/lib/easy-mode-sales-347-reconciliation.ts";
import { derivePersistedEasyModeRunStatus } from "../../app/lib/easy-mode-task-attempts.ts";

const salesOutput = {
  executiveSummary: "Sales plan", targetCustomerProfile: "Owners", salesFunnel: "Awareness to close",
  leadGenerationStrategy: "Referrals", salesChannels: "Direct", outreachStrategy: "Email",
  pricingRecommendations: "Value based", salesKPIs: "Conversion", actionPlan: "Launch",
  salesScript: "Opening", proposal: "Proposal", closingStrategy: "Follow up",
};
const executionMetadata = { id: SALES_347_EXECUTION_ID, status: "success", workflowId: SALES_347_WORKFLOW_ID };
const fixedBody = {
  projectId: SALES_347_PROJECT_ID, runId: SALES_347_RUN_ID, taskId: SALES_347_TASK_ID,
  usageId: SALES_347_USAGE_ID, executionId: SALES_347_EXECUTION_ID,
};
const request = (body) => new Request("https://example.invalid/internal", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fake" },
  body: JSON.stringify(body),
});
const boss = { verify: async () => ({ uid: "boss" }), isBoss: () => true };

test("saved JSON reconciliation requires boss-admin authentication", async () => {
  const never = {
    verify: async () => { throw new Error("invalid token"); }, isBoss: () => false,
    parse: () => assert.fail("unexpected"), verifyExecution: async () => assert.fail("unexpected"),
    validate: async () => assert.fail("unexpected"),
    apply: async () => assert.fail("unexpected"),
  };
  const response = await handleSales347Reconciliation(
    request({ ...fixedBody, action: "validate", response: salesOutput }), never,
  );
  assert.equal(response.status, 404);
});

test("direct Sales result is accepted", () => {
  assert.deepEqual(validateSales347Output(salesOutput)?.output, salesOutput);
});

test("one-element Sales result array is accepted", () => {
  assert.deepEqual(validateSales347Output([salesOutput])?.output, salesOutput);
});

test("json-wrapped Sales result is accepted", () => {
  assert.deepEqual(validateSales347Output({ json: salesOutput })?.output, salesOutput);
});

test("harmless Respond-to-Webhook wrappers are accepted", () => {
  assert.deepEqual(validateSales347Output({ response: { body: [{ json: { output: salesOutput } }] } })?.output, salesOutput);
});

test("invalid Sales object is rejected", () => {
  assert.equal(validateSales347Output({ executiveSummary: "incomplete" }), null);
});

test("execution metadata must report successful execution 347 for the fixed Sales workflow", () => {
  assert.equal(validateSales347ExecutionMetadata(executionMetadata), true);
  assert.equal(validateSales347ExecutionMetadata({ ...executionMetadata, id: "348" }), false);
  assert.equal(validateSales347ExecutionMetadata({ ...executionMetadata, status: "running" }), false);
  assert.equal(validateSales347ExecutionMetadata({ ...executionMetadata, workflowId: "other" }), false);
});

test("execution verification performs a metadata-only read and rejects unsuccessful metadata", async () => {
  const priorBaseUrl = process.env.N8N_API_BASE_URL;
  const priorApiKey = process.env.N8N_API_KEY;
  process.env.N8N_API_BASE_URL = "https://n8n.example.invalid";
  process.env.N8N_API_KEY = "test-key";
  try {
    let requestedUrl = "";
    await verifySales347ExecutionMetadata(async (url, init) => {
      requestedUrl = String(url);
      assert.equal(init?.method, "GET");
      return new Response(JSON.stringify(executionMetadata), { status: 200 });
    });
    assert.match(requestedUrl, /\/api\/v1\/executions\/347$/);
    assert.doesNotMatch(requestedUrl, /includeData/);
    await assert.rejects(() => verifySales347ExecutionMetadata(async () =>
      new Response(JSON.stringify({ ...executionMetadata, status: "running" }), { status: 200 })));
  } finally {
    if (priorBaseUrl === undefined) delete process.env.N8N_API_BASE_URL;
    else process.env.N8N_API_BASE_URL = priorBaseUrl;
    if (priorApiKey === undefined) delete process.env.N8N_API_KEY;
    else process.env.N8N_API_KEY = priorApiKey;
  }
});

test("boss validation is read-only and uses only the supplied saved execution", async () => {
  let validations = 0;
  let applies = 0;
  let metadataChecks = 0;
  let parsedResponse;
  const response = await handleSales347Reconciliation(request({ ...fixedBody, action: "validate", response: salesOutput }), {
    ...boss,
    parse: (value) => { parsedResponse = value; return { output: salesOutput, durationMs: null }; },
    verifyExecution: async () => { metadataChecks += 1; },
    validate: async () => { validations += 1; return { state: "validated", outputId: null, salesTaskStatus: "running", runStatus: "running" }; },
    apply: async () => { applies += 1; throw new Error("must not apply"); },
  });
  assert.equal(response.status, 200);
  assert.equal(validations, 1);
  assert.equal(applies, 0);
  assert.equal(metadataChecks, 1);
  assert.deepEqual(parsedResponse, salesOutput);
});

test("wrong fixed execution or usage identifiers are blocked before saved JSON parsing", async () => {
  let parses = 0;
  const dependencies = {
    ...boss, parse: () => { parses += 1; throw new Error("unexpected"); },
    verifyExecution: async () => assert.fail("unexpected"),
    validate: async () => assert.fail("unexpected"), apply: async () => assert.fail("unexpected"),
  };
  assert.equal((await handleSales347Reconciliation(request({ ...fixedBody, executionId: "348", action: "validate", response: salesOutput }), dependencies)).status, 400);
  assert.equal((await handleSales347Reconciliation(request({ ...fixedBody, usageId: "wrong", action: "validate", response: salesOutput }), dependencies)).status, 400);
  assert.equal(parses, 0);
});

test("malformed request JSON is rejected before reconciliation", async () => {
  const malformed = new Request("https://example.invalid/internal", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fake" }, body: "{not-json",
  });
  const dependencies = {
    ...boss, parse: () => assert.fail("unexpected"),
    verifyExecution: async () => assert.fail("unexpected"),
    validate: async () => assert.fail("unexpected"), apply: async () => assert.fail("unexpected"),
  };
  assert.equal((await handleSales347Reconciliation(malformed, dependencies)).status, 400);
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
    ...boss, parse: () => ({ output: salesOutput, durationMs: null }), verifyExecution: async () => {},
    validate: async () => assert.fail("unexpected"), apply,
  };
  const [first, second] = await Promise.all([
    handleSales347Reconciliation(request({ ...fixedBody, action: "reconcile", response: salesOutput }), dependencies),
    handleSales347Reconciliation(request({ ...fixedBody, action: "reconcile", response: salesOutput }), dependencies),
  ]);
  assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(inserts, 1);
});

test("six earlier outputs are preserved and run completion requires seven persisted outputs", () => {
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
  assert.doesNotMatch(service, /leftJoin\(projectOutputs/);
  assert.match(service, /from\(easyModeTasks\)[\s\S]*?for\("update"\)/);
  assert.match(service, /inArray\(projectOutputs\.id, referencedOutputIds\)[\s\S]*?for\("update"\)/);
  assert.match(service, /already_reconciled/);
  assert.match(service, /insert\(projectOutputs\)/);
  assert.match(service, /derivePersistedEasyModeRunStatus/);
  assert.match(service, /tasks\.slice\(0, 6\)\.every/);
  assert.match(service, /eq\(easyModeTasks\.id, SALES_347_TASK_ID\)/);
  assert.match(route, /isBossAdmin/);
  assert.match(page, /type="file"/);
  assert.match(page, /<textarea/);
  assert.match(page, /validatedJson !== savedJson/);
  assert.match(service, /method: "GET"/);
  assert.doesNotMatch(service, /includeData|runData/);
  assert.doesNotMatch(`${service}\n${route}`, /executeTextSpecialistService|startAiUsage|claimNextEasyModeTask|api\.openai\.com/i);
});
