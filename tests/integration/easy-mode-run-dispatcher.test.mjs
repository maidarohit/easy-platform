import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  kickEasyModeRunDispatcher,
  planEasyModeRunDispatch,
} from "../../app/lib/easy-mode-run-dispatcher.ts";
import { buildEasyModeRunStatusLeaseUpdate } from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const now = new Date("2026-09-14T00:00:00.000Z");

function queueRun(index, overrides = {}) {
  const id = `${String(index + 1).padStart(8, "0")}-1111-4111-8111-${String(index + 1).padStart(12, "0")}`;
  return {
    id,
    userId: `user-${index + 1}`,
    projectId: `project-${index + 1}`,
    status: "queued",
    createdAt: new Date(now.getTime() + index * 1_000),
    startedAt: null,
    executionLeaseExpiresAt: null,
    ...overrides,
  };
}

function dispatcherHarness(runs, liveAttemptRunIds = new Set()) {
  let gate = Promise.resolve();
  const state = {
    runs: runs.map((run) => ({ ...run })),
    liveAttemptRunIds: new Set(liveAttemptRunIds),
  };

  async function withLock(work) {
    const previous = gate;
    let release;
    gate = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  return { state, withLock };
}

test("100 queued different projects cannot result in more than 5 concurrently leased active runs", async () => {
  const harness = dispatcherHarness(Array.from({ length: 100 }, (_, index) => queueRun(index)));
  let executions = 0;

  await kickEasyModeRunDispatcher({}, {
    now: () => now,
    maxConcurrentRuns: () => 5,
    claimRuns: (input) => harness.withLock(async () => {
      const plan = planEasyModeRunDispatch({
        runs: harness.state.runs,
        liveAttemptRunIds: harness.state.liveAttemptRunIds,
        now: input.now,
        maxConcurrentRuns: input.maxConcurrentRuns,
      });
      for (const run of harness.state.runs) {
        if (plan.staleRunIds.includes(run.id)) run.status = "queued";
      }
      for (const claimed of plan.claimedRuns) {
        const run = harness.state.runs.find((item) => item.id === claimed.runId);
        if (run) {
          run.status = "running";
          run.executionLeaseExpiresAt = new Date(input.now.getTime() + 900_000);
        }
      }
      return plan;
    }),
    executeRun: async () => {
      executions += 1;
      return { state: "in_progress", message: "running" };
    },
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  });

  assert.equal(executions, 5);
  assert.equal(harness.state.runs.filter((run) => run.status === "running").length, 5);
  assert.equal(harness.state.runs.filter((run) => run.status === "queued").length, 95);
});

test("10 simultaneous dispatcher calls cannot oversubscribe 5 slots", async () => {
  const harness = dispatcherHarness(Array.from({ length: 100 }, (_, index) => queueRun(index)));
  let activeExecutions = 0;
  let peakExecutions = 0;
  let totalExecutions = 0;
  let releaseBarrier;
  const barrier = new Promise((resolve) => { releaseBarrier = resolve; });
  let releaseFive;
  const firstFiveStarted = new Promise((resolve) => { releaseFive = resolve; });

  const kicks = Array.from({ length: 10 }, async () => kickEasyModeRunDispatcher({}, {
    now: () => now,
    maxConcurrentRuns: () => 5,
    claimRuns: (input) => harness.withLock(async () => {
      const plan = planEasyModeRunDispatch({
        runs: harness.state.runs,
        liveAttemptRunIds: harness.state.liveAttemptRunIds,
        now: input.now,
        maxConcurrentRuns: input.maxConcurrentRuns,
      });
      for (const claimed of plan.claimedRuns) {
        const run = harness.state.runs.find((item) => item.id === claimed.runId);
        if (run) {
          run.status = "running";
          run.executionLeaseExpiresAt = new Date(input.now.getTime() + 900_000);
        }
      }
      return plan;
    }),
    executeRun: async () => {
      totalExecutions += 1;
      activeExecutions += 1;
      peakExecutions = Math.max(peakExecutions, activeExecutions);
      if (totalExecutions === 5) releaseFive();
      await barrier;
      activeExecutions -= 1;
      return { state: "in_progress", message: "running" };
    },
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  }));
  await firstFiveStarted;
  releaseBarrier();
  await Promise.all(kicks);

  assert.equal(totalExecutions, 5);
  assert.equal(peakExecutions, 5);
});

test("FIFO oldest queued runs are claimed first", () => {
  const plan = planEasyModeRunDispatch({
    runs: [queueRun(0), queueRun(1), queueRun(2), queueRun(3)],
    liveAttemptRunIds: new Set(),
    now,
    maxConcurrentRuns: 2,
  });
  assert.deepEqual(plan.claimedRuns.map((run) => run.runId), [queueRun(0).id, queueRun(1).id]);
});

test("same project cannot have two queued or running builds in schema and migration", async () => {
  const [schema, migration, route] = await Promise.all([
    source("app/db/schema.ts"),
    source("drizzle/0031_add_easy_mode_run_dispatch_queue.sql"),
    source("app/api/business-build/route.ts"),
  ]);
  assert.match(schema, /easy_mode_runs_one_active_per_project_unique/);
  assert.match(migration, /create unique index "easy_mode_runs_one_active_per_project_unique"/);
  assert.match(route, /easy-mode-project-build:/);
});

test("browser close is irrelevant because server-side creation and callbacks kick the dispatcher", async () => {
  const [buildRoute, callbackRoute, jobsRoute, executeNextRoute] = await Promise.all([
    source("app/api/business-build/route.ts"),
    source("app/api/easy-mode/attempts/[attemptId]/callback/route.ts"),
    source("app/api/ai-manager/jobs/[jobId]/route.ts"),
    source("app/api/easy-mode/runs/[runId]/execute-next/route.ts"),
  ]);
  assert.match(buildRoute, /scheduleEasyModeRunDispatcher/);
  assert.match(callbackRoute, /scheduleEasyModeRunDispatcher/);
  assert.match(jobsRoute, /scheduleEasyModeRunDispatcher/);
  assert.match(executeNextRoute, /scheduleEasyModeRunDispatcher/);
});

test("completed and failed runs release their slots by clearing the run lease", () => {
  const completed = buildEasyModeRunStatusLeaseUpdate("completed", now);
  const failed = buildEasyModeRunStatusLeaseUpdate("failed", now);
  assert.equal(completed.executionLeaseToken, null);
  assert.equal(completed.executionLeaseExpiresAt, null);
  assert.equal(failed.executionLeaseToken, null);
  assert.equal(failed.executionLeaseExpiresAt, null);
});

test("stale running run with no live task attempt is re-queued and can be reclaimed", () => {
  const stale = queueRun(0, {
    status: "running",
    executionLeaseExpiresAt: new Date(now.getTime() - 1),
  });
  const plan = planEasyModeRunDispatch({
    runs: [stale, queueRun(1)],
    liveAttemptRunIds: new Set(),
    now,
    maxConcurrentRuns: 1,
    requestedRunId: stale.id,
    userId: stale.userId,
  });
  assert.deepEqual(plan.staleRunIds, [stale.id]);
  assert.deepEqual(plan.claimedRuns.map((run) => run.runId), [stale.id]);
  assert.equal(plan.requestedRunState, "running");
});

test("expired run lease with a live task attempt still occupies a slot", () => {
  const active = queueRun(0, {
    status: "running",
    executionLeaseExpiresAt: new Date(now.getTime() - 1),
  });
  const plan = planEasyModeRunDispatch({
    runs: [active, queueRun(1)],
    liveAttemptRunIds: new Set([active.id]),
    now,
    maxConcurrentRuns: 1,
    requestedRunId: queueRun(1).id,
    userId: "user-2",
  });
  assert.equal(plan.occupiedSlots, 1);
  assert.deepEqual(plan.staleRunIds, []);
  assert.deepEqual(plan.claimedRuns, []);
  assert.equal(plan.requestedRunState, "queued");
});

test("execute-next cannot bypass the global concurrency limit and queued runs consume zero usage", async () => {
  const requested = queueRun(5);
  const harness = dispatcherHarness([
    ...Array.from({ length: 5 }, (_, index) => queueRun(index, {
      status: "running",
      executionLeaseExpiresAt: new Date(now.getTime() + 60_000),
    })),
    requested,
  ]);
  let executeCalls = 0;

  const result = await kickEasyModeRunDispatcher({ requestedRunId: requested.id, userId: requested.userId }, {
    now: () => now,
    maxConcurrentRuns: () => 5,
    claimRuns: async (input) => planEasyModeRunDispatch({
      runs: harness.state.runs,
      liveAttemptRunIds: harness.state.liveAttemptRunIds,
      now: input.now,
      maxConcurrentRuns: input.maxConcurrentRuns,
      requestedRunId: input.requestedRunId,
      userId: input.userId,
    }),
    executeRun: async () => {
      executeCalls += 1;
      return { state: "in_progress", message: "unexpected" };
    },
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  });

  assert.equal(result.requestedRunState, "queued");
  assert.equal(result.requestedExecution?.message, "This business build is queued and will start soon.");
  assert.equal(executeCalls, 0);
});
