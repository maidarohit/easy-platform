import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";

test("Business Build page keeps re-entering the guarded runner until persisted state changes", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /requestInFlight/);
  assert.match(page, /window\.setInterval\(\(\) => void refreshRun\(\), 3_000\)/);
  assert.match(page, /\["queued", "running"\]\.includes\(loaded\.run\.status\)/);
  assert.match(page, /\/api\/easy-mode\/runs\/\$\{encodeURIComponent\(runId\)\}\/execute-next/);
  assert.doesNotMatch(page, /executionStarted/);
  assert.doesNotMatch(page, /\["queued", "running", "partially_completed"\]/);
  assert.match(page, /"Retry final phase"/);
  assert.match(page, /disabled=\{retrying\}/);
});

test("stale Business Build work cannot poll forever without surfacing support state", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /setError\("Your completed work is safe, but this build needs support\."\)/);
  assert.match(page, /needsAttention = Boolean\(view && \["failed", "partially_completed"\]\.includes\(view\.run\.status\)\)/);
  assert.match(page, /Your build needs support\./);
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
  const fn = attempts.slice(attempts.indexOf("export async function prepareUncertainEasyModeTaskRetry"));
  assert.match(fn, /run\.status !== "partially_completed"/);
  assert.match(fn, /failedTasks\.length !== 1/);
  assert.match(fn, /failedTasks\[0\]\.projectOutputId !== null/);
  assert.match(fn, /safeErrorCode, "DELIVERY_UNCERTAIN"/);
  assert.match(fn, /latestAttempt\?\.id !== attempt\.id/);
  assert.match(fn, /ACTIVE_ATTEMPT_STATUSES/);
  assert.match(fn, /eq\(easyModeTasks\.status, "failed"\)/);
  assert.doesNotMatch(fn, /status: "completed"|delete\(/);
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

test("normal queued execution and completed runs remain unchanged", async () => {
  let claims = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true, claim: async () => { claims += 1; return null; },
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  });
  assert.equal(result.state, "in_progress");
  assert.equal(claims, 1);
});
