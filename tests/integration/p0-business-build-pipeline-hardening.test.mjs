import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun, executeNextEasyModeTask } from "../../app/lib/easy-mode-executor.ts";
import { SpecialistExecutionError } from "../../app/lib/specialist-execution.ts";
import {
  derivePersistedEasyModeRunStatus,
  isRecoverablePreDispatchClaim,
} from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const modules = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"];
const now = new Date("2026-08-28T12:00:00.000Z");
const stranded = {
  attemptStatus: "claimed", providerExecutionId: null, usageId: null,
  leaseExpiresAt: new Date(now.getTime() - 1), taskStatus: "running",
  projectOutputId: null, matchingOutputExists: false,
};

test("normal Business Build completes only with all seven persisted outputs", () => {
  const completed = modules.map((moduleId) => ({ moduleId, status: "completed", projectOutputId: `output-${moduleId}` }));
  assert.equal(derivePersistedEasyModeRunStatus(completed), "completed");
  assert.equal(derivePersistedEasyModeRunStatus(completed.map((task, index) => index === 6
    ? { ...task, status: "running", projectOutputId: null } : task)), "running");
  assert.equal(derivePersistedEasyModeRunStatus(completed.map((task, index) => index === 6
    ? { ...task, projectOutputId: null } : task)), "partially_completed");
});

test("only an expired evidence-free pre-dispatch claim is recoverable", () => {
  assert.equal(isRecoverablePreDispatchClaim(stranded, now), true);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, leaseExpiresAt: new Date(now.getTime() + 1) }, now), false);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, attemptStatus: "dispatching" }, now), false);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, providerExecutionId: "provider-1" }, now), false);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, usageId: "usage-1" }, now), false);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, projectOutputId: "output-1" }, now), false);
  assert.equal(isRecoverablePreDispatchClaim({ ...stranded, matchingOutputExists: true }, now), false);
});

test("automatic recovery reuses guarded failed-before-dispatch and queued transitions", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(attempts, /status: "failed_before_dispatch"/);
  assert.match(attempts, /status: "queued"/);
  assert.match(attempts, /isNull\(easyModeTaskAttempts\.providerExecutionId\)/);
  assert.match(attempts, /isNull\(easyModeTaskAttempts\.usageId\)/);
  assert.match(attempts, /lte\(easyModeTaskAttempts\.leaseExpiresAt, now\)/);
  assert.match(attempts, /gte\(projectOutputs\.createdAt, activeAttempt\.startedAt\)/);
});

test("concurrent execution can dispatch Sales at most once", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  const context = createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId });
  const claim = {
    context, runId, taskId, attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 2, moduleId: "sales", executionKey: "sales-2",
    leaseToken: "44444444-4444-4444-8444-444444444444",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  let claimed = false;
  let providerCalls = 0;
  let persistedOutputs = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => { if (claimed) return null; claimed = true; return claim; },
    loadTextInput: async () => ({ companyName: "Example" }),
    startUsage: async () => "55555555-5555-4555-8555-555555555555",
    bindUsage: async () => {}, markDispatching: async () => {}, markRunning: async () => {},
    executeText: async () => { providerCalls += 1; return { output: { executiveSummary: "Ready" } }; },
    persistText: async () => { persistedOutputs += 1; return { id: "66666666-6666-4666-8666-666666666666" }; },
    completeUsage: async () => {}, completeAttempt: async () => {},
    failUsage: async () => {}, failBeforeDispatch: async () => {}, failUncertain: async () => {},
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  };
  await Promise.all([
    executeNextEasyModeTask({ runId, userId: "user-1" }, dependencies),
    executeNextEasyModeTask({ runId, userId: "user-1" }, dependencies),
  ]);
  assert.equal(providerCalls, 1);
  assert.equal(persistedOutputs, 1);
});

test("successful normal Sales execution persists and completes attempt, task, usage, and 7/7 run", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  const outputId = "66666666-6666-4666-8666-666666666666";
  const context = createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId });
  const claim = {
    context, runId, taskId, attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1, moduleId: "sales", executionKey: "sales-1",
    leaseToken: "44444444-4444-4444-8444-444444444444", leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const firstSix = modules.slice(0, 6).map((moduleId) => ({ moduleId, status: "completed", projectOutputId: `output-${moduleId}` }));
  const before = structuredClone(firstSix);
  const events = [];
  let claimed = false;
  let salesTask = { status: "running", projectOutputId: null };
  const dependencies = {
    enabled: () => true, claim: async () => { if (claimed) return null; claimed = true; return claim; },
    loadTextInput: async () => ({ companyName: "Example" }), startUsage: async () => "55555555-5555-4555-8555-555555555555",
    bindUsage: async () => events.push("usage-bound"), markDispatching: async () => events.push("dispatching"),
    executeText: async () => ({ output: { executiveSummary: "valid normalized output" }, providerExecutionId: "347" }),
    markRunning: async (input) => { assert.equal(input.providerExecutionId, "347"); events.push("running"); },
    persistText: async () => { events.push("output-persisted"); return { id: outputId }; },
    completeUsage: async () => events.push("usage-completed"),
    completeAttempt: async (input) => { assert.equal(input.projectOutputId, outputId); salesTask = { status: "completed", projectOutputId: outputId }; events.push("attempt-task-run-completed"); },
    failUsage: async () => assert.fail("unexpected"), failBeforeDispatch: async () => assert.fail("unexpected"),
    failUncertain: async () => assert.fail("unexpected"),
    progress: async () => ({ runStatus: salesTask.status === "completed" ? "Completed" : "In progress", tasks: [] }),
  };
  const result = await executeNextEasyModeTask({ runId, userId: "user-1" }, dependencies);
  assert.equal(result.state, "completed");
  assert.equal(result.progress.runStatus, "Completed");
  assert.deepEqual(events, ["usage-bound", "dispatching", "running", "output-persisted", "usage-completed", "attempt-task-run-completed"]);
  assert.deepEqual(firstSix, before);
  assert.equal(derivePersistedEasyModeRunStatus([...firstSix, { moduleId: "sales", ...salesTask }]), "completed");
});

test("timeout after Sales dispatch becomes delivery-uncertain and never issues another provider call", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  const context = createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId });
  const claim = {
    context, runId, taskId, attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1, moduleId: "sales", executionKey: "sales-1",
    leaseToken: "44444444-4444-4444-8444-444444444444", leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  let claims = 0;
  let providerCalls = 0;
  let uncertainFailures = 0;
  const result = await executeEasyModeRun({ runId, userId: "user-1" }, {
    enabled: () => true, claim: async () => { claims += 1; return claims === 1 ? claim : null; },
    loadTextInput: async () => ({ companyName: "Example" }), startUsage: async () => "55555555-5555-4555-8555-555555555555",
    bindUsage: async () => {}, markDispatching: async () => {},
    executeText: async () => { providerCalls += 1; throw new SpecialistExecutionError("uncertain"); },
    failUsage: async () => {}, failUncertain: async () => { uncertainFailures += 1; },
    failBeforeDispatch: async () => assert.fail("unexpected"), reconcileUncertain: async () => ({ state: "unresolved" }),
    progress: async () => ({ runStatus: "Needs attention", tasks: [] }),
  });
  assert.equal(result.state, "needs_attention");
  assert.equal(providerCalls, 1);
  assert.equal(uncertainFailures, 1);
  assert.equal(claims, 1);
});

test("one execute-next request runs at most one provider-backed task and the next request advances the run", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const websiteTask = {
    context: createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" }),
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1,
    moduleId: "website",
    executionKey: "website-1",
    leaseToken: "44444444-4444-4444-8444-444444444444",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const marketingTask = {
    ...websiteTask,
    taskId: "55555555-5555-4555-8555-555555555555",
    attemptId: "66666666-6666-4666-8666-666666666666",
    executionKey: "marketing-1",
    leaseToken: "77777777-7777-4777-8777-777777777777",
    moduleId: "marketing",
  };
  const claims = [websiteTask, marketingTask];
  const executions = [];
  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadTextInput: async (_context, module) => ({ companyName: module }),
    startUsage: async ({ module }) => `${module}-usage`,
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async ({ module }) => {
      executions.push(module);
      return module === "website"
        ? { output: { websiteOverview: "Ready" } }
        : { output: { marketingStrategy: "Ready" } };
    },
    markRunning: async () => {},
    persistText: async (_context, module) => ({ id: `${module}-output` }),
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failUsage: async () => assert.fail("unexpected failure"),
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    failUncertain: async () => assert.fail("unexpected uncertainty"),
    progress: async () => ({ runStatus: claims.length === 0 ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "user-1" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(executions, ["website"]);
  assert.equal(claims.length, 1);

  const second = await executeEasyModeRun({ runId, userId: "user-1" }, dependencies);
  assert.equal(second.state, "completed");
  assert.deepEqual(executions, ["website", "marketing"]);
  assert.equal(claims.length, 0);
});

test("AI Manager async dispatch returns without chaining later tasks", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const aiManagerTask = {
    context: createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" }),
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1,
    moduleId: "ai-manager",
    executionKey: "ai-manager-1",
    leaseToken: "44444444-4444-4444-8444-444444444444",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const brandingTask = {
    ...aiManagerTask,
    taskId: "55555555-5555-4555-8555-555555555555",
    attemptId: "66666666-6666-4666-8666-666666666666",
    executionKey: "branding-1",
    leaseToken: "77777777-7777-4777-8777-777777777777",
    moduleId: "branding",
  };
  const claims = [aiManagerTask, brandingTask];
  let jobsStarted = 0;

  const result = await executeEasyModeRun({ runId, userId: "user-1" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadAiManagerInput: async () => ({
      companyName: "Example",
      businessDescription: "Helpful services.",
      industry: "Services",
      businessGoal: "Grow",
    }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    startAiManagerJob: async () => {
      jobsStarted += 1;
      return { jobId: "job-1" };
    },
    markRunning: async () => {},
    failUsage: async () => assert.fail("unexpected failure"),
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    failUncertain: async () => assert.fail("unexpected uncertainty"),
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  });

  assert.equal(result.state, "in_progress");
  assert.equal(jobsStarted, 1);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].moduleId, "branding");
});

test("failed task stops the request without executing following tasks", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const marketingTask = {
    context: createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" }),
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1,
    moduleId: "marketing",
    executionKey: "marketing-1",
    leaseToken: "44444444-4444-4444-8444-444444444444",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const seoTask = {
    ...marketingTask,
    taskId: "55555555-5555-4555-8555-555555555555",
    attemptId: "66666666-6666-4666-8666-666666666666",
    executionKey: "seo-1",
    leaseToken: "77777777-7777-4777-8777-777777777777",
    moduleId: "seo",
  };
  const claims = [marketingTask, seoTask];
  let providerCalls = 0;

  const result = await executeEasyModeRun({ runId, userId: "user-1" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadTextInput: async () => ({ companyName: "Example" }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async () => {
      providerCalls += 1;
      throw new SpecialistExecutionError("uncertain", 504, { failureCategory: "timeout" });
    },
    failUsage: async () => {},
    failUncertain: async () => {},
    failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
    reconcileUncertain: async () => ({ state: "unresolved" }),
    progress: async () => ({ runStatus: "Needs attention", tasks: [] }),
  });

  assert.equal(result.state, "needs_attention");
  assert.equal(providerCalls, 1);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].moduleId, "seo");
});

test("marketing webhook failure category is logged safely", async () => {
  const runId = "11111111-1111-4111-8111-111111111111";
  const claim = {
    context: createTrustedModuleExecutionContext({ userId: "user-1", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" }),
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptNumber: 1,
    moduleId: "marketing",
    executionKey: "marketing-1",
    leaseToken: "44444444-4444-4444-8444-444444444444",
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => { logged.push(args); };
  try {
    const result = await executeNextEasyModeTask({ runId, userId: "user-1" }, {
      enabled: () => true,
      claim: async () => claim,
      loadTextInput: async () => ({ companyName: "Example" }),
      startUsage: async () => "usage-1",
      bindUsage: async () => {},
      markDispatching: async () => {},
      executeText: async () => {
        throw new SpecialistExecutionError("uncertain", 504, { failureCategory: "timeout" });
      },
      failUsage: async () => {},
      failUncertain: async () => {},
      failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
      progress: async () => ({ runStatus: "Needs attention", tasks: [] }),
    });
    assert.equal(result.state, "needs_attention");
  } finally {
    console.error = originalError;
  }

  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "Easy Mode provider-backed task failed.");
  assert.deepEqual(logged[0][1], {
    runId,
    taskId: claim.taskId,
    module: "marketing",
    attemptId: claim.attemptId,
    failureCategory: "timeout",
    upstreamStatus: null,
    elapsedMs: logged[0][1].elapsedMs,
  });
  assert.equal(typeof logged[0][1].elapsedMs, "number");
});

test("six completed outputs stay untouched and polling resumes through the guarded runner", async () => {
  const [attempts, easyPage, buildPage, runs] = await Promise.all([
    source("app/lib/easy-mode-task-attempts.ts"),
    source("app/easy-mode/page.tsx"),
    source("app/business-build/page.tsx"),
    source("app/api/easy-mode/runs/route.ts"),
  ]);
  assert.doesNotMatch(attempts, /delete\(projectOutputs\)|update\(projectOutputs\)/);
  assert.match(easyPage, /requestInFlight/);
  assert.match(easyPage, /execute-next/);
  assert.match(buildPage, /requestInFlight/);
  assert.match(buildPage, /execute-next/);
  assert.match(buildPage, /if \(\["queued", "running"\]\.includes\(loaded\.run\.status\)\)/);
  assert.doesNotMatch(buildPage, /executionStarted/);
  assert.match(runs, /onConflictDoNothing/);
  assert.match(runs, /easyModeRuns_owner_project_idempotency_unique|idempotencyKey/);
});
