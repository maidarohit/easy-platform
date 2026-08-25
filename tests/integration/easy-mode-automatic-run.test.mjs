import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";

function localClaim(index) {
  const digit = String(index + 2);
  const taskId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return {
    context: createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId }),
    runId, taskId,
    attemptId: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-9${digit.repeat(3)}-${digit.repeat(12)}`,
    attemptNumber: 1, moduleId: "branding-context", executionKey: `execution-${index}`,
    leaseToken: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-a${digit.repeat(3)}-${digit.repeat(12)}`,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

test("one start advances sequentially through every successful eligible task", async () => {
  const claims = [localClaim(0), localClaim(1), localClaim(2)];
  let completed = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadBrandingContext: async () => ({ project: { name: "Example", industry: "Services" } }),
    persistContext: async () => ({ id: `output-${completed}` }),
    markRunning: async () => {},
    completeAttempt: async () => { completed += 1; },
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    progress: async () => ({ runStatus: completed === 3 ? "Completed" : "In progress", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.equal(completed, 3);
  assert.equal(claims.length, 0);
});

test("automatic advancement stops immediately on a failed task", async () => {
  let claims = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => { claims += 1; return localClaim(0); },
    loadBrandingContext: async () => { throw new Error("local failure"); },
    failBeforeDispatch: async () => {},
    progress: async () => ({ runStatus: "Needs attention", tasks: [] }),
  });
  assert.equal(result.state, "needs_attention");
  assert.equal(claims, 1);
});

test("AI Manager completion resumes the automatic runner and the UI does not offer another start", async () => {
  const callback = await source("app/api/ai-manager/jobs/[jobId]/route.ts");
  const route = await source("app/api/easy-mode/runs/[runId]/execute-next/route.ts");
  const page = await source("app/easy-mode/page.tsx");
  assert.match(callback, /syncEasyModeAiManagerTask\(jobId\)/);
  assert.match(callback, /executeEasyModeRun\(continuation\)/);
  assert.match(route, /executeEasyModeRun/);
  assert.match(page, /runView\.run\.status === "running"/);
  assert.match(page, /Building automatically/);
  assert.match(page, /window\.setInterval\(\(\) => void refreshRun\(\), 3_000\)/);
  assert.match(page, /runView\?\.run\.status/);
});
