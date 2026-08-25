import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";
import { MalformedJsonBodyError, readOptionalLimitedJson } from "../../app/lib/request-body.ts";

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

function brandingClaim() {
  return { ...localClaim(0), moduleId: "branding" };
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

test("completed Business plan can hand off to Branding and continue automatically", async () => {
  const claims = [brandingClaim(), localClaim(1)];
  const events = [];
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadBrandingInput: async () => ({
      companyName: "Example", industry: "Services", targetAudience: "Owners",
      brandStyle: "A".repeat(500), brandDescription: "Helpful services.",
    }),
    startUsage: async () => { events.push("usage"); return "usage-1"; },
    bindUsage: async () => { events.push("bound"); },
    markDispatching: async () => { events.push("dispatching"); },
    executeBranding: async () => { events.push("branding"); return { output: { brandName: "Example" } }; },
    markRunning: async () => { events.push("running"); },
    persistBranding: async () => ({ id: "branding-output" }),
    completeUsage: async () => { events.push("usage-complete"); },
    completeAttempt: async () => { events.push("task-complete"); },
    loadBrandingContext: async () => ({ project: { name: "Example", industry: "Services" } }),
    persistContext: async () => ({ id: "context-output" }),
    failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage failure"),
    progress: async () => ({ runStatus: claims.length === 0 ? "Completed" : "In progress", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.deepEqual(events.slice(0, 7), [
    "usage", "bound", "dispatching", "branding", "running", "usage-complete", "task-complete",
  ]);
  assert.equal(claims.length, 0);
});

test("server-built Branding and downstream specialist context is bounded to strict short-field contracts", async () => {
  const branding = await source("app/lib/branding-execution.ts");
  const specialists = await source("app/lib/text-specialist-execution.ts");
  assert.match(branding, /brandStyle: .*\.slice\(0, 500\)/);
  assert.match(branding, /targetAudience: [\s\S]*?\.slice\(0, 500\)/);
  assert.match(specialists, /const brandStyle = .*\.slice\(0, 500\)/);
  assert.match(specialists, /const targetAudience = [\s\S]*?\.slice\(0, 500\)/);
});

test("safe Branding Retry accepts an empty POST then rebuilds bounded server-owned input", async () => {
  const emptyRetry = new Request("https://example.invalid/retry", { method: "POST" });
  assert.equal(await readOptionalLimitedJson(emptyRetry, 1024), undefined);
  const explicitRetry = new Request("https://example.invalid/retry", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.deepEqual(await readOptionalLimitedJson(explicitRetry, 1024), {});
  await assert.rejects(
    readOptionalLimitedJson(new Request("https://example.invalid/retry", { method: "POST", body: "{" }), 1024),
    MalformedJsonBodyError,
  );

  const retryRoute = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  const executor = await source("app/lib/easy-mode-executor.ts");
  assert.match(retryRoute, /readOptionalLimitedJson/);
  assert.match(retryRoute, /prepareEasyModeTaskRetry/);
  assert.match(executor, /const brandingInput = await dependencies\.loadBrandingInput\(claim\.context\)/);
  assert.doesNotMatch(retryRoute, /brandStyle|targetAudience|taskInput|payload/);
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
