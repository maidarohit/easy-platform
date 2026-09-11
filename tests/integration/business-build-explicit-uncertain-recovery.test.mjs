import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";
import { evaluateFailedTaskRetryEligibility } from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";
const baseDigit = (taskNumber) => String(taskNumber + 2);

function claimFor(moduleId, taskNumber, attemptNumber = 1) {
  const digit = baseDigit(taskNumber);
  const attemptDigit = String(attemptNumber + 5);
  const taskId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return {
    context: createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId }),
    runId,
    taskId,
    attemptId: `${attemptDigit.repeat(8)}-${attemptDigit.repeat(4)}-4${attemptDigit.repeat(3)}-9${attemptDigit.repeat(3)}-${attemptDigit.repeat(12)}`,
    attemptNumber,
    moduleId,
    executionKey: `${moduleId}-${attemptNumber}`,
    leaseToken: `${attemptDigit.repeat(8)}-${attemptDigit.repeat(4)}-4${attemptDigit.repeat(3)}-a${attemptDigit.repeat(3)}-${attemptDigit.repeat(12)}`,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

function retrySnapshot(overrides = {}) {
  return {
    runStatus: "failed",
    taskId: "22222222-2222-4222-8222-222222222222",
    taskStatus: "failed",
    projectOutputId: null,
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptTaskId: "22222222-2222-4222-8222-222222222222",
    attemptStatus: "failed_uncertain",
    attemptSafeErrorCode: "TASK_FAILED",
    latestAttemptId: "33333333-3333-4333-8333-333333333333",
    activeAttemptId: null,
    ...overrides,
  };
}

test("Business Build page keeps re-entering the guarded runner until persisted state changes", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /requestInFlight/);
  assert.match(page, /window\.setInterval\(\(\) => void refreshRun\(\), 3_000\)/);
  assert.match(page, /\["queued", "running"\]\.includes\(loaded\.run\.status\)/);
  assert.match(page, /\/api\/easy-mode\/runs\/\$\{encodeURIComponent\(runId\)\}\/execute-next/);
  assert.doesNotMatch(page, /executionStarted/);
  assert.doesNotMatch(page, /\["queued", "running", "partially_completed"\]/);
  assert.match(page, /"Retry failed phase"/);
  assert.doesNotMatch(page, /"Retry final phase"/);
  assert.match(page, /disabled=\{retrying\}/);
});

test("stale Business Build work cannot poll forever without surfacing support state", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /setError\("Your completed work is safe, but this build needs support\."\)/);
  assert.match(page, /needsAttention = Boolean\(view && \["failed", "partially_completed"\]\.includes\(view\.run\.status\)\)/);
  assert.match(page, /Your build needs support\./);
});

test("shared retry eligibility allows safe first-phase and later-phase failed retries and blocks unsafe states", () => {
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot()).allowed, true);
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot({
    attemptSafeErrorCode: "DELIVERY_UNCERTAIN",
  })).allowed, true);
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot({
    runStatus: "partially_completed",
    attemptStatus: "failed_before_dispatch",
    attemptSafeErrorCode: "TASK_FAILED",
  })).allowed, true);

  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    activeAttemptId: "44444444-4444-4444-8444-444444444444",
  })), { allowed: false, reason: "active_attempt" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    taskStatus: "completed",
  })), { allowed: false, reason: "task_not_failed" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    projectOutputId: "55555555-5555-4555-8555-555555555555",
  })), { allowed: false, reason: "task_has_output" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    latestAttemptId: "66666666-6666-4666-8666-666666666666",
  })), { allowed: false, reason: "attempt_not_latest" });
});

test("uncertain recovery route reconciles first and only then prepares the named failed task", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
  const recovery = route.slice(route.indexOf('if (attempt.status === "failed_uncertain")'));
  assert.ok(recovery.indexOf("reconcileUncertainEasyModeAttempt") < recovery.indexOf("prepareUncertainEasyModeTaskRetry"));
  assert.match(route, /ownedTask\.projectOutputId !== null/);
  assert.match(route, /executeEasyModeRun\(\{ runId, userId \}\)/);
});

test("uncertain retry preparation fails closed and preserves completed tasks", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  const retryPreparation = attempts.slice(attempts.indexOf("async function prepareFailedTaskRetry"));
  assert.match(attempts, /evaluateFailedTaskRetryEligibility/);
  assert.match(attempts, /RETRYABLE_UNCERTAIN_SAFE_ERROR_CODES = new Set\(\["DELIVERY_UNCERTAIN", "TASK_FAILED"\]\)/);
  assert.match(attempts, /inArray\(easyModeRuns\.status, \["failed", "partially_completed"\]\)/);
  assert.match(attempts, /eq\(easyModeTasks\.status, "failed"\)/);
  assert.match(attempts, /ACTIVE_ATTEMPT/);
  assert.match(retryPreparation, /status: "queued"/);
  assert.doesNotMatch(retryPreparation, /status: "completed"|delete\(/);
});

test("customer view and retry backend use the same shared failed-task retry policy", async () => {
  const [customerStatus, route] = await Promise.all([
    source("app/lib/easy-mode-customer-status.ts"),
    source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts"),
  ]);
  assert.match(customerStatus, /evaluateFailedTaskRetryEligibility/);
  assert.match(customerStatus, /const canRetry = eligibility\.allowed/);
  assert.doesNotMatch(customerStatus, /allowUncertainRecovery === false/);
  assert.match(route, /ACTIVE_ATTEMPT/);
  assert.match(route, /This failed step cannot be retried yet\./);
  assert.match(route, /This step is already being handled\./);
});

test("duplicate execution claims do not produce two provider calls", async () => {
  let claims = 0;
  let providers = 0;
  const claim = {
    context: { userId: "firebase-user", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" },
    runId, taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333", attemptNumber: 2,
    moduleId: "sales", executionKey: "sales-retry",
    leaseToken: "44444444-4444-4444-8444-444444444444", leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const dependencies = {
    enabled: () => true,
    claim: async () => (++claims === 1 ? claim : null),
    loadTextInput: async () => ({}), startUsage: async () => "usage-1", bindUsage: async () => {},
    markDispatching: async () => {}, executeText: async () => { providers += 1; return { output: {} }; },
    markRunning: async () => {}, persistText: async () => ({ id: "sales-output" }),
    completeUsage: async () => {}, completeAttempt: async () => {},
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    failUncertain: async () => assert.fail("unexpected failure"), failUsage: async () => {},
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  };
  await Promise.all([
    executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies),
    executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies),
  ]);
  assert.equal(providers, 1);
});

test("first-phase retryable failure re-queues phase 1 and leaves later phases untouched until the next request", async () => {
  const aiManagerTask = claimFor("ai-manager", 0, 1);
  const retriedAiManagerTask = claimFor("ai-manager", 0, 2);
  const untouchedBrandingTask = claimFor("branding", 1, 1);
  const claims = [aiManagerTask, retriedAiManagerTask, untouchedBrandingTask];
  const retriedAttempts = [];
  let aiManagerLoads = 0;
  let jobsStarted = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadAiManagerInput: async () => {
      aiManagerLoads += 1;
      if (aiManagerLoads === 1) throw new Error("temporary phase-1 failure");
      return {
        companyName: "Example",
        businessDescription: "Helpful services.",
        industry: "Services",
        businessGoal: "Grow",
      };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: aiManagerTask.taskId, retryReady: true };
    },
    startUsage: async () => "55555555-5555-4555-8555-555555555555",
    bindUsage: async () => {},
    markDispatching: async () => {},
    startAiManagerJob: async () => {
      jobsStarted += 1;
      return { jobId: "66666666-6666-4666-8666-666666666666" };
    },
    markRunning: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("usage should not start before the retry-safe failure"),
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.equal(aiManagerLoads, 1);
  assert.equal(jobsStarted, 0);
  assert.deepEqual(retriedAttempts, [aiManagerTask.attemptId]);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].moduleId, "ai-manager");

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "in_progress");
  assert.equal(aiManagerLoads, 2);
  assert.equal(jobsStarted, 1);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].moduleId, "branding");
});

test("middle-phase retry reruns only the failed phase and later work advances on the following request", async () => {
  const brandingTask = claimFor("branding", 1, 1);
  const retriedBrandingTask = claimFor("branding", 1, 2);
  const websiteTask = claimFor("website", 2, 1);
  const claims = [brandingTask, retriedBrandingTask, websiteTask];
  const events = [];
  const retriedAttempts = [];
  let brandingLoads = 0;
  let websiteCompleted = false;
  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadBrandingInput: async () => {
      brandingLoads += 1;
      if (brandingLoads === 1) throw new Error("temporary branding failure");
      events.push("branding-load");
      return {
        companyName: "Example",
        industry: "Services",
        targetAudience: "Owners",
        brandStyle: "Professional",
        brandDescription: "Helpful services.",
      };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: brandingTask.taskId, retryReady: true };
    },
    startUsage: async ({ module }) => `${module === "branding" ? "55555555" : "66666666"}-5555-4555-8555-555555555555`,
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeBranding: async () => {
      events.push("branding-execute");
      return { output: { brandName: "Example" } };
    },
    persistBranding: async () => {
      events.push("branding-persist");
      return { id: "77777777-7777-4777-8777-777777777777" };
    },
    loadTextInput: async (_context, module) => {
      assert.equal(module, "website");
      events.push("website-load");
      return { companyName: "Example" };
    },
    executeText: async ({ module }) => {
      assert.equal(module, "website");
      events.push("website-execute");
      return { output: { websiteOverview: "Ready" } };
    },
    persistText: async (_context, module) => {
      assert.equal(module, "website");
      websiteCompleted = true;
      events.push("website-persist");
      return { id: "88888888-8888-4888-8888-888888888888" };
    },
    markRunning: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage finalization failure"),
    progress: async () => ({ runStatus: websiteCompleted ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(retriedAttempts, [brandingTask.attemptId]);
  assert.equal(brandingLoads, 1);
  assert.equal(claims.length, 2);

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "in_progress");
  assert.equal(brandingLoads, 2);
  assert.equal(claims.length, 1);

  const third = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(third.state, "completed");
  assert.deepEqual(events, [
    "branding-load",
    "branding-execute",
    "branding-persist",
    "website-load",
    "website-execute",
    "website-persist",
  ]);
  assert.equal(claims.length, 0);
});

test("normal queued execution and completed runs remain unchanged", async () => {
  let claims = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true, claim: async () => { claims += 1; return null; },
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.equal(claims, 1);
});
