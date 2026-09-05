import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { handleBusinessBuildGet, handleBusinessBuildPost } from "../../app/api/business-build/route.ts";
import { confirmedDnaExecutionContext } from "../../app/lib/easy-mode-project-context.ts";

const projectId = "project-task-5";
const request = () => new Request("http://local/api/business-build", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }),
});

function harness({ confirmed = true, allowance = { ok: true, requirements: [] } } = {}) {
  let run = null;
  let creates = 0;
  const deps = {
    verify: async () => ({ uid: "owner" }),
    loadDna: async () => ({ confirmed, revisionCount: 7, dna: { identity: { businessName: "DNA Name" } } }),
    findRun: async (_userId, _projectId, key) => !key || run?.idempotencyKey === key ? run : null,
    preflight: async () => allowance,
    createRun: async ({ userId, projectId: ownedProjectId, idempotencyKey }) => {
      creates += 1;
      if (run) return null;
      run = { id: "11111111-1111-4111-8111-111111111111", userId, projectId: ownedProjectId, goalId: "build_everything", status: "queued", idempotencyKey, createdAt: new Date(0), startedAt: null, completedAt: null, failedAt: null };
      return run;
    },
    responseForRun: async (value) => ({ run: { id: value.id, status: value.status }, tasks: [], progress: { total: 7, queued: 7, completed: 0, failed: 0 } }),
  };
  return { deps, creates: () => creates, run: () => run };
}

test("1 unconfirmed Business DNA cannot start a build", async () => {
  const mock = harness({ confirmed: false });
  const response = await handleBusinessBuildPost(request(), mock.deps);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "BUSINESS_DNA_NOT_CONFIRMED");
  assert.equal(mock.creates(), 0);
});

test("2 confirmed DNA starts exactly one build_everything run", async () => {
  const mock = harness();
  const response = await handleBusinessBuildPost(request(), mock.deps);
  assert.equal(response.status, 201);
  assert.equal(mock.creates(), 1);
  assert.equal(mock.run().goalId, "build_everything");
  assert.equal(mock.run().idempotencyKey, "business-dna-build:7");
});

test("3 double click returns the same revision-bound run without duplication", async () => {
  const mock = harness();
  const first = await handleBusinessBuildPost(request(), mock.deps);
  const second = await handleBusinessBuildPost(request(), mock.deps);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).run.id, (await second.json()).run.id);
  assert.equal(mock.creates(), 1);
});

test("3b simultaneous requests converge on one database-authoritative run", async () => {
  let run = null;
  let createCalls = 0;
  let arrivals = 0;
  let releaseCreates;
  const createBarrier = new Promise((resolve) => { releaseCreates = resolve; });
  const deps = {
    verify: async () => ({ uid: "owner" }),
    loadDna: async () => ({ confirmed: true, revisionCount: 7, dna: {} }),
    findRun: async (_userId, _projectId, key) => !key || run?.idempotencyKey === key ? run : null,
    preflight: async () => ({ ok: true, requirements: [] }),
    createRun: async ({ userId, projectId: ownedProjectId, idempotencyKey }) => {
      createCalls += 1;
      arrivals += 1;
      if (arrivals === 2) releaseCreates();
      await createBarrier;
      if (run) return null;
      run = { id: "22222222-2222-4222-8222-222222222222", userId, projectId: ownedProjectId, goalId: "build_everything", status: "queued", idempotencyKey, createdAt: new Date(0), startedAt: null, completedAt: null, failedAt: null };
      return run;
    },
    responseForRun: async (value) => ({ run: { id: value.id, status: value.status }, tasks: [], progress: { total: 7, queued: 7, completed: 0, failed: 0 } }),
  };

  const [first, second] = await Promise.all([
    handleBusinessBuildPost(request(), deps),
    handleBusinessBuildPost(request(), deps),
  ]);
  const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
  assert.equal(createCalls, 2);
  assert.deepEqual([first.status, second.status].sort(), [200, 201]);
  assert.equal(firstBody.run.id, secondBody.run.id);
});

test("4 refresh restores the same run and never creates one", async () => {
  const mock = harness();
  await handleBusinessBuildPost(request(), mock.deps);
  const response = await handleBusinessBuildGet(new Request(`http://local/api/business-build?projectId=${projectId}`), mock.deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).run.id, mock.run().id);
  assert.equal(mock.creates(), 1);
});

test("5 confirmed DNA projection is primary specialist context", () => {
  const context = confirmedDnaExecutionContext({
    businessDna: { confirmed: true, dna: {
      identity: { businessName: "Confirmed DNA Name", industry: "Confirmed industry" },
      customers: { targetAudience: "Confirmed audience" }, offer: { services: ["Confirmed service"] },
      goals: { primaryGoal: "Confirmed goal" }, conversation: { originalVisionText: "Confirmed description" },
    } },
  });
  assert.equal(context.companyName, "Confirmed DNA Name");
  assert.equal(context.industry, "Confirmed industry");
  assert.equal(context.targetAudience, "Confirmed audience");
  assert.equal(context.businessGoal, "Confirmed goal");
});

test("6 entitlement rejection remains authoritative and creates no run", async () => {
  const mock = harness({ allowance: { ok: false, allowance: { reason: "PLAN_LIMIT_REACHED", category: "standardAiTasks", used: 10, limit: 10 }, requirement: { category: "standardAiTasks", taskCount: 6 } } });
  const response = await handleBusinessBuildPost(request(), mock.deps);
  assert.equal(response.status, 429);
  assert.equal(mock.creates(), 0);
});

test("7 UI exposes one build action, friendly phases, and the real workspace", async () => {
  const [onboarding, progress] = await Promise.all([
    readFile("app/onboarding/page.tsx", "utf8"), readFile("app/business-build/page.tsx", "utf8"),
  ]);
  assert.match(onboarding, /"Build My Business"/);
  assert.match(onboarding, /buildStartInFlight\.current/);
  assert.match(onboarding, /disabled=\{isStartingBuild\}/);
  assert.match(onboarding, /Starting your build/);
  assert.doesNotMatch(onboarding, /coming in Task 5/);
  for (const label of ["Understanding your direction", "Creating your brand", "Building your online presence", "Preparing your marketing", "Setting up growth foundations", "Finalizing your business workspace"]) assert.match(progress, new RegExp(label));
  assert.match(progress, /\/master-workspace\?projectId=/);
  assert.match(progress, /task\.status === "failed" && task\.canRetry/);
  assert.match(progress, /"Try again"/);
  assert.doesNotMatch(progress, /Start (?:Branding|Website|Marketing|SEO|Sales)/);
});

test("8 existing durable execution preserves output reuse and uncertainty policy", async () => {
  const [attempts, executor] = await Promise.all([
    readFile("app/lib/easy-mode-task-attempts.ts", "utf8"), readFile("app/lib/easy-mode-executor.ts", "utf8"),
  ]);
  assert.match(attempts, /canExplicitlyRetryAttempt[\s\S]*failed_before_dispatch/);
  assert.match(attempts, /failed_uncertain[\s\S]*projectOutputId/);
  assert.match(attempts, /reconcileUncertainEasyModeAttempt/);
  assert.match(executor, /projectOutputs/);
});

test("9 Task 5 tests make zero provider and n8n calls", async () => {
  const route = await readFile("app/api/business-build/route.ts", "utf8");
  assert.doesNotMatch(route, /fetch\s*\(|OpenAI|Gemini|getN8nWebhookConfig|executeValidatedJsonWebhook/);
});

test("10 Task 5 reuses the locked specialist order and scoped entitlement system", async () => {
  const [plans, entitlements, route] = await Promise.all([
    readFile("app/lib/easy-mode-plans.ts", "utf8"), readFile("app/lib/paid-entitlements.ts", "utf8"),
    readFile("app/api/business-build/route.ts", "utf8"),
  ]);
  assert.match(plans, /build_everything:\s*\["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"\]/);
  assert.match(route, /preflightEasyModePlanQuota/);
  assert.match(route, /buildKey\(dna\.revisionCount\)/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /transaction\.insert\(easyModeTasks\)/);
  assert.match(entitlements, /PRIVATE_BETA_UIDS_TEST/);
  assert.doesNotMatch(entitlements, /NEXT_PUBLIC_PRIVATE_BETA/);
});
