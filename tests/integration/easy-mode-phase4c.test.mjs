import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canExplicitlyRetryAttempt,
  evaluateFailedTaskRetryEligibility,
} from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("only known pre-dispatch failures are retryable", () => {
  assert.equal(canExplicitlyRetryAttempt("failed_before_dispatch"), true);
  assert.equal(canExplicitlyRetryAttempt("failed_uncertain"), false);
  assert.equal(canExplicitlyRetryAttempt("running"), false);
  assert.equal(canExplicitlyRetryAttempt("completed"), false);
  assert.equal(evaluateFailedTaskRetryEligibility({
    runStatus: "failed",
    taskId: "task-1",
    taskStatus: "failed",
    projectOutputId: null,
    attemptId: "attempt-1",
    attemptTaskId: "task-1",
    attemptStatus: "failed_uncertain",
    attemptSafeErrorCode: "TASK_FAILED",
    latestAttemptId: "attempt-1",
    activeAttemptId: null,
  }).allowed, true);
});

test("retry API is owner scoped and selects only the latest task attempt", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(easyModeTaskAttempts\.userId, userId\)/);
  assert.match(route, /orderBy\(desc\(easyModeTaskAttempts\.attemptNumber\)\)\.limit\(1\)/);
  assert.match(route, /prepareEasyModeTaskRetry/);
  assert.match(route, /prepareUncertainEasyModeTaskRetry/);
});

test("retry preparation is atomic, duplicate safe, and does not charge or dispatch", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(attempts, /eq\(easyModeTasks\.status, "failed"\)/);
  assert.match(attempts, /if \(!task\) throw new EasyModeAttemptError\("RETRY_NOT_ALLOWED"\)/);
  assert.match(attempts, /status: "queued"/);
  assert.doesNotMatch(route, /startAiUsage|completeAiUsage|fetch\(|N8N_|publish/);
});

test("Easy Mode and Master Workspace hide internal failures and customer retry controls", async () => {
  const customerStatus = await source("app/lib/easy-mode-customer-status.ts");
  const runsRoute = await source("app/api/easy-mode/runs/route.ts");
  const runRoute = await source("app/api/easy-mode/runs/[runId]/route.ts");
  const easyPage = await source("app/easy-mode/page.tsx");
  const workspacePage = await source("app/master-workspace/page.tsx");
  assert.match(customerStatus, /"Failed" \| "Needs attention"/);
  assert.match(customerStatus, /attempt\?\.status === "failed_uncertain"/);
  assert.match(customerStatus, /const canRetry = eligibility\.allowed/);
  assert.match(customerStatus, /canRetry/);
  assert.doesNotMatch(runsRoute, /safeErrorCode/);
  assert.doesNotMatch(runRoute, /safeErrorCode/);
  assert.doesNotMatch(easyPage, />Retry</);
  assert.doesNotMatch(workspacePage, />RETRY</);
  assert.match(easyPage, /Please contact support\. Your completed work is saved safely\./);
  assert.doesNotMatch(easyPage, /failed_uncertain|DELIVERY_UNCERTAIN|PROVIDER_/);
  assert.doesNotMatch(workspacePage, /failed_uncertain|DELIVERY_UNCERTAIN|PROVIDER_/);
});

test("customer runner pages use durable execute-next and never publish directly", async () => {
  const easyPage = await source("app/easy-mode/page.tsx");
  const buildPage = await source("app/business-build/page.tsx");
  const workspacePage = await source("app/master-workspace/page.tsx");
  assert.match(easyPage, /\/execute-next/);
  assert.match(buildPage, /\/execute-next/);
  assert.doesNotMatch(easyPage, /N8N_|\/api\/(branding-ai|website-ai)|publish/);
  assert.doesNotMatch(buildPage, /N8N_|\/api\/(branding-ai|website-ai)|publish/);
  assert.doesNotMatch(workspacePage, /N8N_|getN8nWebhookConfig|executeValidatedJsonWebhook/);
});
