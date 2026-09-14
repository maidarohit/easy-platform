import "server-only";

import { after } from "next/server";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTaskAttempts } from "@/app/db/schema";
import { executeEasyModeRun, getEasyModeCustomerProgress, type ExecuteNextResult } from "@/app/lib/easy-mode-executor";
import {
  buildEasyModeRunExecutionLease,
  clearEasyModeRunExecutionLease,
  EASY_MODE_ACTIVE_ATTEMPT_STATUSES,
} from "@/app/lib/easy-mode-task-attempts";

const DEFAULT_MAX_CONCURRENT_RUNS = 5;
const MIN_MAX_CONCURRENT_RUNS = 1;
const MAX_MAX_CONCURRENT_RUNS = 25;
const DISPATCH_ADVISORY_LOCK_KEY = "easy-mode-run-dispatcher";

type DispatchInput = Readonly<{ requestedRunId?: string; userId?: string }>;
type RequestedRunState = "not_found" | "queued" | "running" | "completed" | "failed";
type ClaimedRun = Readonly<{ runId: string; userId: string }>;
export type DispatchableRun = Readonly<{
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  executionLeaseExpiresAt: Date | null;
}>;

export type EasyModeDispatchKickResult = Readonly<{
  requestedRunState: RequestedRunState;
  requestedExecution: ExecuteNextResult | null;
  startedRunIds: readonly string[];
  maxConcurrentRuns: number;
  occupiedSlots: number;
}>;

type DispatchDependencies = Readonly<{
  now: () => Date;
  maxConcurrentRuns: () => number;
  claimRuns: (input: Readonly<{ requestedRunId?: string; userId?: string; now: Date; maxConcurrentRuns: number }>) => Promise<Readonly<{
    requestedRunState: RequestedRunState;
    occupiedSlots: number;
    claimedRuns: readonly ClaimedRun[];
    continueRuns: readonly ClaimedRun[];
  }>>;
  executeRun: typeof executeEasyModeRun;
  progress: typeof getEasyModeCustomerProgress;
}>;

export function planEasyModeRunDispatch(input: Readonly<{
  runs: readonly DispatchableRun[];
  liveAttemptRunIds: ReadonlySet<string>;
  now: Date;
  maxConcurrentRuns: number;
  requestedRunId?: string;
  userId?: string;
}>): Readonly<{
  requestedRunState: RequestedRunState;
  occupiedSlots: number;
  staleRunIds: readonly string[];
  claimedRuns: readonly ClaimedRun[];
  continueRuns: readonly ClaimedRun[];
}> {
  const runs = input.runs.map((run) => ({ ...run }));
  const staleRunIds = runs
    .filter((run) =>
      run.status === "running" &&
      !(run.executionLeaseExpiresAt && run.executionLeaseExpiresAt.getTime() > input.now.getTime()) &&
      !input.liveAttemptRunIds.has(run.id))
    .map((run) => run.id);
  for (const run of runs) {
    if (staleRunIds.includes(run.id)) run.status = "queued";
  }

  const occupiedRunIds = new Set(runs
    .filter((run) =>
      run.status === "running" &&
      ((run.executionLeaseExpiresAt && run.executionLeaseExpiresAt.getTime() > input.now.getTime()) || input.liveAttemptRunIds.has(run.id)))
    .map((run) => run.id));

  const freeSlots = Math.max(0, input.maxConcurrentRuns - occupiedRunIds.size);
  const candidates = runs.filter((run) => run.status === "queued").slice(0, freeSlots);
  const claimedRuns = candidates.map((run) => ({ runId: run.id, userId: run.userId }));
  for (const run of candidates) occupiedRunIds.add(run.id);

  let requestedRunState: RequestedRunState = "not_found";
  const continueRuns: ClaimedRun[] = [];
  if (input.requestedRunId) {
    const requested = runs.find((run) => run.id === input.requestedRunId && (!input.userId || run.userId === input.userId));
    if (requested) {
      if (occupiedRunIds.has(requested.id)) {
        requestedRunState = "running";
        continueRuns.push({ runId: requested.id, userId: requested.userId });
      } else if (requested.status === "queued") {
        requestedRunState = "queued";
      }
    }
  }

  return {
    requestedRunState,
    occupiedSlots: occupiedRunIds.size,
    staleRunIds,
    claimedRuns,
    continueRuns,
  };
}

export function clampEasyModeMaxConcurrentRuns(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_CONCURRENT_RUNS;
  return Math.min(MAX_MAX_CONCURRENT_RUNS, Math.max(MIN_MAX_CONCURRENT_RUNS, parsed));
}

export function getEasyModeMaxConcurrentRuns(): number {
  return clampEasyModeMaxConcurrentRuns(process.env.EASY_MODE_MAX_CONCURRENT_RUNS);
}

function statusFromProgress(progress: Awaited<ReturnType<typeof getEasyModeCustomerProgress>>): RequestedRunState {
  if (progress.runStatus === "Completed") return "completed";
  if (progress.runStatus === "Needs attention") return "failed";
  return "running";
}

const defaultDependencies: DispatchDependencies = {
  now: () => new Date(),
  maxConcurrentRuns: getEasyModeMaxConcurrentRuns,
  claimRuns: async ({ requestedRunId, userId, now, maxConcurrentRuns }) => db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${DISPATCH_ADVISORY_LOCK_KEY}))`);

    const activeRuns = await transaction.select({
      id: easyModeRuns.id,
      userId: easyModeRuns.userId,
      status: easyModeRuns.status,
      createdAt: easyModeRuns.createdAt,
      startedAt: easyModeRuns.startedAt,
      executionLeaseExpiresAt: easyModeRuns.executionLeaseExpiresAt,
    }).from(easyModeRuns)
      .where(inArray(easyModeRuns.status, ["queued", "running"]))
      .orderBy(asc(easyModeRuns.createdAt))
      .for("update");

    const runIds = activeRuns.map((run) => run.id);
    const liveAttemptRows = runIds.length === 0
      ? []
      : await transaction.select({ runId: easyModeTaskAttempts.runId }).from(easyModeTaskAttempts)
        .where(and(
          inArray(easyModeTaskAttempts.runId, runIds),
          inArray(easyModeTaskAttempts.status, [...EASY_MODE_ACTIVE_ATTEMPT_STATUSES]),
          gt(easyModeTaskAttempts.leaseExpiresAt, now),
        ));
    const liveAttemptRunIds = new Set(liveAttemptRows.map((row) => row.runId));
    const plan = planEasyModeRunDispatch({
      runs: activeRuns,
      liveAttemptRunIds,
      now,
      maxConcurrentRuns,
      requestedRunId,
      userId,
    });

    if (plan.staleRunIds.length > 0) {
      await transaction.update(easyModeRuns).set({
        status: "queued",
        completedAt: null,
        failedAt: null,
        ...clearEasyModeRunExecutionLease(),
      }).where(inArray(easyModeRuns.id, [...plan.staleRunIds]));
    }
    for (const claimed of plan.claimedRuns) {
      const run = activeRuns.find((entry) => entry.id === claimed.runId);
      if (!run) continue;
      const lease = buildEasyModeRunExecutionLease(now);
      await transaction.update(easyModeRuns).set({
        status: "running",
        startedAt: run.startedAt ?? now,
        completedAt: null,
        failedAt: null,
        ...lease,
      }).where(eq(easyModeRuns.id, claimed.runId));
    }
    let requestedRunState = plan.requestedRunState;
    let requestedTerminalState: RequestedRunState | null = null;
    if (requestedRunId) {
      if (requestedRunState === "not_found") {
        const [terminal] = await transaction.select({
          status: easyModeRuns.status,
        }).from(easyModeRuns).where(and(
          eq(easyModeRuns.id, requestedRunId),
          ...(userId ? [eq(easyModeRuns.userId, userId)] : []),
        )).limit(1);
        if (terminal?.status === "completed") requestedTerminalState = "completed";
        else if (terminal?.status === "failed" || terminal?.status === "partially_completed" || terminal?.status === "cancelled") {
          requestedTerminalState = "failed";
        }
      }
    }
    if (requestedRunState === "not_found" && requestedTerminalState) requestedRunState = requestedTerminalState;
    for (const continued of plan.continueRuns) {
      const lease = buildEasyModeRunExecutionLease(now);
      await transaction.update(easyModeRuns).set({
        ...lease,
        completedAt: null,
        failedAt: null,
      }).where(eq(easyModeRuns.id, continued.runId));
    }

    return {
      requestedRunState,
      occupiedSlots: plan.occupiedSlots,
      claimedRuns: plan.claimedRuns,
      continueRuns: plan.continueRuns,
    };
  }),
  executeRun: executeEasyModeRun,
  progress: getEasyModeCustomerProgress,
};

export async function kickEasyModeRunDispatcher(
  input: DispatchInput = {},
  overrides: Partial<DispatchDependencies> = {},
): Promise<EasyModeDispatchKickResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const now = dependencies.now();
  const maxConcurrentRuns = dependencies.maxConcurrentRuns();
  const claimed = await dependencies.claimRuns({
    requestedRunId: input.requestedRunId,
    userId: input.userId,
    now,
    maxConcurrentRuns,
  });
  const runsToExecute = new Map<string, ClaimedRun>();
  for (const run of [...claimed.claimedRuns, ...claimed.continueRuns]) {
    runsToExecute.set(run.runId, run);
  }

  let requestedExecution: ExecuteNextResult | null = null;
  if (runsToExecute.size > 0) {
    const results = await Promise.allSettled([...runsToExecute.values()].map(async (run) => {
      const result = await dependencies.executeRun({ runId: run.runId, userId: run.userId });
      return { runId: run.runId, result };
    }));
    for (const entry of results) {
      if (entry.status === "fulfilled" && entry.value.runId === input.requestedRunId) {
        requestedExecution = entry.value.result;
      }
    }
  }

  if (!requestedExecution && input.requestedRunId && input.userId && claimed.requestedRunState !== "not_found") {
    try {
      const progress = await dependencies.progress(input.requestedRunId, input.userId);
      const progressState = statusFromProgress(progress);
      const requestedRunState =
        claimed.requestedRunState === "queued" && progressState === "running"
          ? "queued"
          : progressState;
      requestedExecution = {
        state: progress.runStatus === "Completed" ? "completed" : progress.runStatus === "Needs attention" ? "needs_attention" : "in_progress",
        message: claimed.requestedRunState === "queued"
          ? "This business build is queued and will start soon."
          : progress.runStatus === "Completed"
            ? "This business build is complete."
            : progress.runStatus === "Needs attention"
              ? "This business build needs attention before it can continue."
              : "This business build is already in progress or has no waiting steps.",
        progress,
      };
      return {
        requestedRunState,
        requestedExecution,
        startedRunIds: [...runsToExecute.keys()],
        maxConcurrentRuns,
        occupiedSlots: claimed.occupiedSlots,
      };
    } catch {}
  }

  return {
    requestedRunState: requestedExecution?.progress ? statusFromProgress(requestedExecution.progress) : claimed.requestedRunState,
    requestedExecution,
    startedRunIds: [...runsToExecute.keys()],
    maxConcurrentRuns,
    occupiedSlots: claimed.occupiedSlots,
  };
}

export function scheduleEasyModeRunDispatcher(input: DispatchInput = {}) {
  try {
    after(async () => {
      try {
        await kickEasyModeRunDispatcher(input);
      } catch (error) {
        console.error("Easy Mode dispatcher kick failed:", error);
      }
    });
  } catch {}
}
