import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { retryBusinessBuildTask } from "../../app/lib/business-build-retry.ts";
import { canExplicitlyRetryAttempt } from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("only failed_before_dispatch remains explicitly retryable", () => {
  assert.equal(canExplicitlyRetryAttempt("failed_before_dispatch"), true);
  assert.equal(canExplicitlyRetryAttempt("failed_uncertain"), false);
});

test("Business Build shows Try again only for failed retryable tasks", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /task\.status === "failed" && task\.canRetry/);
  assert.match(page, />\{retryingTaskId === task\.id \? "Trying again…" : "Try again"\}<\/button>/);
  assert.doesNotMatch(page, /useEffect\([\s\S]*tasks\/\$\{encodeURIComponent\([^)]*\)\}\/retry/);
});

test("Try again uses the existing authenticated retry endpoint, prevents duplicates, and refreshes state", async () => {
  const requests = [];
  let refreshes = 0;
  let releaseRetry;
  const retryPending = new Promise((resolve) => { releaseRetry = resolve; });
  const inFlightTaskIds = new Set();
  const request = async (input, init) => {
    requests.push({ input, init });
    if (String(input).endsWith("/retry")) await retryPending;
    return Response.json({ state: "ready" });
  };
  const input = {
    runId: "run/1",
    taskId: "task/1",
    inFlightTaskIds,
    request,
    refreshBuild: async () => { refreshes += 1; },
  };

  const first = retryBusinessBuildTask(input);
  const duplicate = retryBusinessBuildTask(input);
  assert.equal(requests.length, 1);
  releaseRetry();
  await Promise.all([first, duplicate]);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].input, "/api/easy-mode/runs/run%2F1/tasks/task%2F1/retry");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.body, "{}");
  assert.equal(requests[1].input, "/api/easy-mode/runs/run%2F1/execute-next");
  assert.equal(refreshes, 2);
  assert.equal(inFlightTaskIds.size, 0);
});

test("retry helper uses authenticatedFetch by default and surfaces failure without continuing", async () => {
  const helper = await source("app/lib/business-build-retry.ts");
  assert.match(helper, /import \{ authenticatedFetch \}/);
  assert.match(helper, /request = authenticatedFetch/);

  let refreshes = 0;
  const inFlightTaskIds = new Set();
  await assert.rejects(
    retryBusinessBuildTask({
      runId: "run-1",
      taskId: "task-1",
      inFlightTaskIds,
      request: async () => Response.json({ error: "internal detail" }, { status: 409 }),
      refreshBuild: async () => { refreshes += 1; },
    }),
    /Unable to retry this step safely/,
  );
  assert.equal(refreshes, 0);
  assert.equal(inFlightTaskIds.size, 0);
});

test("Business Build converts retry failures to a safe customer message", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /setError\("We could not safely retry this step\. Please try again\."\)/);
  assert.doesNotMatch(page, /console\.(?:log|error)[\s\S]*retry/i);
});
