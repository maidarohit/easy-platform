import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";
import { BrandingExecutionError } from "../../app/lib/branding-execution.ts";
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

test("known-safe pre-dispatch failure is retried internally once without customer action", async () => {
  const claims = [localClaim(0), { ...localClaim(0), attemptId: localClaim(1).attemptId }, localClaim(2)];
  let loads = 0;
  let retries = 0;
  let completed = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadBrandingContext: async () => {
      loads += 1;
      if (loads === 1) throw new Error("temporary local failure");
      return { project: { name: "Example", industry: "Services" } };
    },
    prepareRetry: async () => { retries += 1; return { taskId: localClaim(0).taskId, retryReady: true }; },
    persistContext: async () => ({ id: "context-output" }),
    markRunning: async () => {},
    completeAttempt: async () => { completed += 1; },
    failBeforeDispatch: async () => {},
    progress: async () => ({ runStatus: completed === 2 ? "Completed" : "In progress", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.equal(retries, 1);
  assert.equal(loads, 3);
});

test("uncertain execution reconciles existing output before continuation and is never replayed", async () => {
  const claims = [brandingClaim(), localClaim(1)];
  const events = [];
  let usageStarts = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => { events.push("claim"); return claims.shift() ?? null; },
    loadBrandingInput: async () => ({ companyName: "Example" }),
    startUsage: async () => { usageStarts += 1; return "usage-1"; },
    bindUsage: async () => {}, markDispatching: async () => {},
    executeBranding: async () => { events.push("provider"); throw new BrandingExecutionError("DELIVERY_UNCERTAIN", "uncertain"); },
    failUsage: async () => {}, failUncertain: async () => { events.push("uncertain"); },
    reconcileUncertain: async () => { events.push("reconcile"); return { state: "completed", projectOutputId: "existing-output" }; },
    prepareRetry: async () => assert.fail("uncertain work must never be retried"),
    loadBrandingContext: async () => ({ project: { name: "Example", industry: "Services" } }),
    persistContext: async () => ({ id: "context-output" }),
    markRunning: async () => {}, completeAttempt: async () => {},
    failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
    progress: async () => ({ runStatus: claims.length === 0 ? "Completed" : "In progress", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.equal(usageStarts, 1);
  assert.equal(events.filter((event) => event === "provider").length, 1);
  assert.ok(events.indexOf("reconcile") < events.lastIndexOf("claim"));
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
  assert.match(page, /runView\.run\.status !== "running"/);
  assert.match(page, /Building your business\.\.\./);
  assert.match(page, /Open Business Workspace/);
  assert.doesNotMatch(page, />Start Building</);
  assert.doesNotMatch(page, />Retry</);
  assert.match(page, /window\.setInterval\(\(\) => void refreshRun\(\), 3_000\)/);
  assert.match(page, /runView\?\.run\.status/);
});
