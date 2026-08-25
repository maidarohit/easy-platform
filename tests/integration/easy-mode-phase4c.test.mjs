import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canExplicitlyRetryAttempt } from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("only known pre-dispatch failures are retryable", () => {
  assert.equal(canExplicitlyRetryAttempt("failed_before_dispatch"), true);
  assert.equal(canExplicitlyRetryAttempt("failed_uncertain"), false);
  assert.equal(canExplicitlyRetryAttempt("running"), false);
  assert.equal(canExplicitlyRetryAttempt("completed"), false);
});

test("retry API is owner scoped and selects only the latest task attempt", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(easyModeTaskAttempts\.userId, userId\)/);
  assert.match(route, /orderBy\(desc\(easyModeTaskAttempts\.attemptNumber\)\)\.limit\(1\)/);
  assert.match(route, /canExplicitlyRetryAttempt\(attempt\.status\)/);
  assert.match(route, /prepareEasyModeTaskRetry/);
});

test("retry preparation is atomic, duplicate safe, and does not charge or dispatch", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(attempts, /eq\(easyModeTasks\.status, "failed"\)/);
  assert.match(attempts, /if \(!task\) throw new EasyModeAttemptError\("RETRY_NOT_ALLOWED"\)/);
  assert.match(attempts, /status: "queued"/);
  assert.doesNotMatch(route, /startAiUsage|completeAiUsage|fetch\(|N8N_|publish/);
});

test("Easy Mode and Master Workspace hide internal failures and gate Retry", async () => {
  const customerStatus = await source("app/lib/easy-mode-customer-status.ts");
  const runsRoute = await source("app/api/easy-mode/runs/route.ts");
  const runRoute = await source("app/api/easy-mode/runs/[runId]/route.ts");
  const easyPage = await source("app/easy-mode/page.tsx");
  const workspacePage = await source("app/master-workspace/page.tsx");
  assert.match(customerStatus, /"Failed" \| "Needs attention"/);
  assert.match(customerStatus, /attempt\?\.status === "failed_uncertain"/);
  assert.match(customerStatus, /canRetry/);
  assert.doesNotMatch(runsRoute, /safeErrorCode/);
  assert.doesNotMatch(runRoute, /safeErrorCode/);
  assert.match(easyPage, /task\.canRetry/);
  assert.match(workspacePage, /module\.canRetry/);
  assert.doesNotMatch(easyPage, /failed_uncertain|DELIVERY_UNCERTAIN|PROVIDER_/);
  assert.doesNotMatch(workspacePage, /failed_uncertain|DELIVERY_UNCERTAIN|PROVIDER_/);
});

test("retry uses durable execute-next and never publishes", async () => {
  const easyPage = await source("app/easy-mode/page.tsx");
  const workspacePage = await source("app/master-workspace/page.tsx");
  assert.match(easyPage, /\/execute-next/);
  assert.match(workspacePage, /\/execute-next/);
  assert.doesNotMatch(easyPage, /N8N_|\/api\/(branding-ai|website-ai)|publish/);
  assert.doesNotMatch(workspacePage, /N8N_|\/api\/(branding-ai|website-ai)|publish/);
});
