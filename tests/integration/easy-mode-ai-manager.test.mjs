import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeNextEasyModeTask } from "../../app/lib/easy-mode-executor.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const leaseToken = "44444444-4444-4444-8444-444444444444";
const usageId = "55555555-5555-4555-8555-555555555555";
const jobId = "66666666-6666-4666-8666-666666666666";

test("Easy Mode AI Manager starts one usage and one asynchronous job without completing early", async () => {
  const calls = { usage: 0, bind: 0, dispatch: 0, job: 0, running: 0, complete: 0 };
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId });
  const result = await executeNextEasyModeTask({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => ({
      context, runId, taskId, attemptId, attemptNumber: 1, moduleId: "ai-manager",
      executionKey: "ai-manager-execution", leaseToken, leaseExpiresAt: new Date(Date.now() + 60_000),
    }),
    loadAiManagerInput: async () => ({ companyName: "Example", businessDescription: "Helpful services.", industry: "Services", businessGoal: "Grow" }),
    startUsage: async () => { calls.usage += 1; return usageId; },
    bindUsage: async () => { calls.bind += 1; },
    markDispatching: async () => { calls.dispatch += 1; },
    startAiManagerJob: async () => { calls.job += 1; return { jobId }; },
    markRunning: async (input) => { calls.running += 1; assert.equal(input.providerExecutionId, jobId); },
    completeAttempt: async () => { calls.complete += 1; },
    failUsage: async () => assert.fail("usage must remain open for callback"),
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    failUncertain: async () => assert.fail("unexpected failure"),
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  });
  assert.equal(result.state, "in_progress");
  assert.deepEqual(calls, { usage: 1, bind: 1, dispatch: 1, job: 1, running: 1, complete: 0 });
});

test("callback retains secret/idempotency and durably syncs validated Easy Mode output", async () => {
  const callback = await source("app/api/ai-manager/jobs/[jobId]/route.ts");
  const service = await source("app/lib/easy-mode-ai-manager.ts");
  assert.match(callback, /AI_MANAGER_CALLBACK_SECRET/);
  assert.match(callback, /inArray\(aiManagerJobs\.status, \["pending", "processing"\]\)/);
  assert.match(callback, /syncEasyModeAiManagerTask\(jobId\)/);
  assert.match(service, /eq\(easyModeTaskAttempts\.usageId, job\.usageId\)/);
  assert.match(service, /getModuleAdapter\("ai-manager"\)\?\.validateOutput/);
  assert.match(service, /insert\(projectOutputs\)/);
  assert.match(service, /module: "ai-manager"/);
  assert.match(service, /projectOutputId: outputId/);
  assert.match(service, /status: job\.status === "completed" \? "completed" : "failed_uncertain"/);
  assert.doesNotMatch(service, /publishWebsite|websitePublications|publishedWebsites/);
});
