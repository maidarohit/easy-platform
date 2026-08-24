import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import {
  aiUsage,
  easyModeRuns,
  easyModeTaskAttempts,
  easyModeTasks,
  projectOutputs,
  projects,
  type EasyModeRunStatus,
  type EasyModeTaskAttemptStatus,
} from "@/app/db/schema";
import {
  createTrustedModuleExecutionContext,
  getModuleAdapter,
  type EasyModePlannedModuleId,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { resolveEasyModePlan } from "@/app/lib/easy-mode-plans";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_ATTEMPT_STATUSES = ["claimed", "dispatching", "running"] as const;
const SAFE_ERROR_CODES = new Set([
  "TASK_FAILED",
  "OUTPUT_INVALID",
  "LIMIT_REACHED",
  "PROVIDER_UNAVAILABLE",
  "DELIVERY_UNCERTAIN",
  "CANCELLED",
]);
const MIN_LEASE_MS = 30_000;
const MAX_LEASE_MS = 15 * 60_000;
const DEFAULT_LEASE_MS = 5 * 60_000;

export type EasyModeAttemptFailureStatus = "failed_before_dispatch" | "failed_uncertain";

export class EasyModeAttemptError extends Error {
  readonly code:
    | "INVALID_REQUEST"
    | "RUN_NOT_FOUND"
    | "PLAN_MISMATCH"
    | "MODULE_UNSUPPORTED"
    | "ACTIVE_ATTEMPT"
    | "NO_ELIGIBLE_TASK"
    | "LEASE_INVALID"
    | "INVALID_TRANSITION"
    | "USAGE_NOT_FOUND"
    | "USAGE_CONFLICT"
    | "RETRY_NOT_ALLOWED";

  constructor(code: EasyModeAttemptError["code"]) {
    super(code);
    this.name = "EasyModeAttemptError";
    this.code = code;
  }
}

export type ClaimedEasyModeTask = Readonly<{
  context: TrustedModuleExecutionContext;
  runId: string;
  taskId: string;
  attemptId: string;
  attemptNumber: number;
  moduleId: EasyModePlannedModuleId;
  executionKey: string;
  leaseToken: string;
  leaseExpiresAt: Date;
}>;

type ClaimInput = Readonly<{
  runId: string;
  userId: string;
  leaseDurationMs?: number;
  allowedModuleIds?: readonly EasyModePlannedModuleId[];
}>;
type LeasedAttemptInput = Readonly<{ attemptId: string; userId: string; leaseToken: string }>;
type FailureInput = LeasedAttemptInput & Readonly<{ safeErrorCode: string }>;

export function validateLeaseToken(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function validateUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

function leaseDuration(value: number | undefined) {
  if (value === undefined) return DEFAULT_LEASE_MS;
  if (!Number.isSafeInteger(value) || value < MIN_LEASE_MS || value > MAX_LEASE_MS) {
    throw new EasyModeAttemptError("INVALID_REQUEST");
  }
  return value;
}

function safeErrorCode(value: unknown): string {
  if (typeof value !== "string" || !SAFE_ERROR_CODES.has(value)) {
    throw new EasyModeAttemptError("INVALID_REQUEST");
  }
  return value;
}

export function canExplicitlyRetryAttempt(status: EasyModeTaskAttemptStatus): boolean {
  return status === "failed_before_dispatch";
}

export function deriveEasyModeRunStatus(statuses: readonly string[]): EasyModeRunStatus {
  const completed = statuses.filter((status) => status === "completed").length;
  const failed = statuses.filter((status) => status === "failed").length;
  const unfinished = statuses.filter((status) => status === "queued" || status === "running").length;
  if (unfinished === 0 && failed === 0) return "completed";
  if (failed > 0) return completed > 0 ? "partially_completed" : "failed";
  return "running";
}

export async function claimNextEasyModeTask(input: ClaimInput): Promise<ClaimedEasyModeTask | null> {
  const runId = validateUuid(input.runId);
  if (!runId || !input.userId || input.userId.length > 128) throw new EasyModeAttemptError("INVALID_REQUEST");
  const durationMs = leaseDuration(input.leaseDurationMs);

  return db.transaction(async (transaction) => {
    const [run] = await transaction.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.id, runId),
      eq(easyModeRuns.userId, input.userId),
    )).limit(1).for("update");
    if (!run) throw new EasyModeAttemptError("RUN_NOT_FOUND");

    const [ownedProject] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, run.projectId),
      eq(projects.userId, input.userId),
    )).limit(1);
    if (!ownedProject) throw new EasyModeAttemptError("RUN_NOT_FOUND");
    if (["completed", "failed", "cancelled"].includes(run.status)) return null;

    const plan = resolveEasyModePlan(run.goalId);
    if (!plan) throw new EasyModeAttemptError("PLAN_MISMATCH");
    const tasks = await transaction.select().from(easyModeTasks)
      .where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
    if (tasks.length !== plan.length || tasks.some((task, position) => task.position !== position || task.moduleId !== plan[position])) {
      throw new EasyModeAttemptError("PLAN_MISMATCH");
    }

    const [activeAttempt] = await transaction.select({ id: easyModeTaskAttempts.id })
      .from(easyModeTaskAttempts).where(and(
        eq(easyModeTaskAttempts.runId, run.id),
        inArray(easyModeTaskAttempts.status, [...ACTIVE_ATTEMPT_STATUSES]),
      )).limit(1);
    if (activeAttempt) return null;

    const task = tasks.find((candidate) => candidate.status === "queued");
    if (!task) return null;
    if (input.allowedModuleIds && !input.allowedModuleIds.includes(task.moduleId as EasyModePlannedModuleId)) {
      throw new EasyModeAttemptError("MODULE_UNSUPPORTED");
    }
    const adapter = getModuleAdapter(task.moduleId);
    if (!adapter || adapter.executionSupport === "unsupported") {
      throw new EasyModeAttemptError("MODULE_UNSUPPORTED");
    }

    const attemptNumber = task.attemptCount + 1;
    const executionKey = randomUUID();
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + durationMs);
    const [attempt] = await transaction.insert(easyModeTaskAttempts).values({
      taskId: task.id,
      runId: run.id,
      userId: input.userId,
      projectId: run.projectId,
      attemptNumber,
      executionKey,
      status: "claimed",
      leaseToken,
      leaseExpiresAt,
    }).returning({ id: easyModeTaskAttempts.id });
    if (!attempt) throw new EasyModeAttemptError("ACTIVE_ATTEMPT");

    const now = new Date();
    const [claimedTask] = await transaction.update(easyModeTasks).set({
      status: "running",
      attemptCount: attemptNumber,
      startedAt: now,
      completedAt: null,
      failedAt: null,
      safeErrorCode: null,
    }).where(and(eq(easyModeTasks.id, task.id), eq(easyModeTasks.status, "queued"))).returning({ id: easyModeTasks.id });
    if (!claimedTask) throw new EasyModeAttemptError("ACTIVE_ATTEMPT");

    await transaction.update(easyModeRuns).set({
      status: "running",
      startedAt: run.startedAt ?? now,
      completedAt: null,
      failedAt: null,
    }).where(eq(easyModeRuns.id, run.id));

    return Object.freeze({
      context: createTrustedModuleExecutionContext({ userId: input.userId, projectId: run.projectId, runId: run.id, taskId: task.id }),
      runId: run.id,
      taskId: task.id,
      attemptId: attempt.id,
      attemptNumber,
      moduleId: task.moduleId as EasyModePlannedModuleId,
      executionKey,
      leaseToken,
      leaseExpiresAt,
    });
  });
}

async function loadLeasedAttempt(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: LeasedAttemptInput,
  statuses: readonly EasyModeTaskAttemptStatus[],
) {
  const attemptId = validateUuid(input.attemptId);
  const leaseToken = validateLeaseToken(input.leaseToken);
  if (!attemptId || !leaseToken || !input.userId || input.userId.length > 128) {
    throw new EasyModeAttemptError("INVALID_REQUEST");
  }
  const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
    eq(easyModeTaskAttempts.id, attemptId),
    eq(easyModeTaskAttempts.userId, input.userId),
    eq(easyModeTaskAttempts.leaseToken, leaseToken),
    gt(easyModeTaskAttempts.leaseExpiresAt, new Date()),
    inArray(easyModeTaskAttempts.status, [...statuses]),
  )).limit(1).for("update");
  if (!attempt) throw new EasyModeAttemptError("LEASE_INVALID");
  return attempt;
}

async function transitionActiveAttempt(
  input: LeasedAttemptInput,
  from: readonly EasyModeTaskAttemptStatus[],
  status: "dispatching" | "running",
) {
  return db.transaction(async (transaction) => {
    const attempt = await loadLeasedAttempt(transaction, input, from);
    const [updated] = await transaction.update(easyModeTaskAttempts).set({ status })
      .where(and(eq(easyModeTaskAttempts.id, attempt.id), inArray(easyModeTaskAttempts.status, [...from])))
      .returning({ id: easyModeTaskAttempts.id, status: easyModeTaskAttempts.status });
    if (!updated) throw new EasyModeAttemptError("INVALID_TRANSITION");
    return updated;
  });
}

export const markEasyModeAttemptDispatching = (input: LeasedAttemptInput) =>
  transitionActiveAttempt(input, ["claimed"], "dispatching");

export const markEasyModeAttemptRunning = (input: LeasedAttemptInput) =>
  transitionActiveAttempt(input, ["claimed", "dispatching"], "running");

export async function bindEasyModeAttemptUsage(input: LeasedAttemptInput & Readonly<{ usageId: string }>) {
  const usageId = validateUuid(input.usageId);
  if (!usageId) throw new EasyModeAttemptError("INVALID_REQUEST");
  return db.transaction(async (transaction) => {
    const [usage] = await transaction.select().from(aiUsage).where(eq(aiUsage.id, usageId)).limit(1).for("update");
    if (!usage || usage.userId !== input.userId) throw new EasyModeAttemptError("USAGE_NOT_FOUND");
    const attempt = await loadLeasedAttempt(transaction, input, ACTIVE_ATTEMPT_STATUSES);
    if (usage.projectId !== attempt.projectId) throw new EasyModeAttemptError("USAGE_NOT_FOUND");
    if (attempt.usageId === usageId) return Object.freeze({ attemptId: attempt.id, usageId });
    if (attempt.usageId) throw new EasyModeAttemptError("USAGE_CONFLICT");
    const [otherAttempt] = await transaction.select({ id: easyModeTaskAttempts.id }).from(easyModeTaskAttempts)
      .where(eq(easyModeTaskAttempts.usageId, usageId)).limit(1);
    if (otherAttempt) throw new EasyModeAttemptError("USAGE_CONFLICT");
    const [updated] = await transaction.update(easyModeTaskAttempts).set({ usageId }).where(and(
      eq(easyModeTaskAttempts.id, attempt.id),
      eq(easyModeTaskAttempts.leaseToken, input.leaseToken),
    )).returning({ id: easyModeTaskAttempts.id });
    if (!updated) throw new EasyModeAttemptError("USAGE_CONFLICT");
    return Object.freeze({ attemptId: attempt.id, usageId });
  });
}

async function refreshRunStatus(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  runId: string,
) {
  const tasks = await transaction.select({ status: easyModeTasks.status }).from(easyModeTasks)
    .where(eq(easyModeTasks.runId, runId));
  const status = deriveEasyModeRunStatus(tasks.map((task) => task.status));
  const now = new Date();
  await transaction.update(easyModeRuns).set({
    status,
    completedAt: status === "completed" ? now : null,
    failedAt: status === "failed" || status === "partially_completed" ? now : null,
  }).where(eq(easyModeRuns.id, runId));
  return status;
}

export async function completeEasyModeAttempt(input: LeasedAttemptInput & Readonly<{ projectOutputId?: string }>) {
  return db.transaction(async (transaction) => {
    const attempt = await loadLeasedAttempt(transaction, input, ["running"]);
    let projectOutputId: string | null = null;
    if (input.projectOutputId !== undefined) {
      const outputId = validateUuid(input.projectOutputId);
      if (!outputId) throw new EasyModeAttemptError("INVALID_REQUEST");
      const [ownedOutput] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
        eq(projectOutputs.id, outputId),
        eq(projectOutputs.userId, attempt.userId),
        eq(projectOutputs.projectId, attempt.projectId),
      )).limit(1);
      if (!ownedOutput) throw new EasyModeAttemptError("INVALID_TRANSITION");
      projectOutputId = ownedOutput.id;
    }
    const now = new Date();
    const [updated] = await transaction.update(easyModeTaskAttempts).set({
      status: "completed", finishedAt: now, safeErrorCode: null,
    }).where(and(eq(easyModeTaskAttempts.id, attempt.id), eq(easyModeTaskAttempts.status, "running")))
      .returning({ id: easyModeTaskAttempts.id });
    if (!updated) throw new EasyModeAttemptError("INVALID_TRANSITION");
    await transaction.update(easyModeTasks).set({
      status: "completed", completedAt: now, failedAt: null, safeErrorCode: null, projectOutputId,
    }).where(and(eq(easyModeTasks.id, attempt.taskId), eq(easyModeTasks.status, "running")));
    const runStatus = await refreshRunStatus(transaction, attempt.runId);
    return Object.freeze({ attemptId: attempt.id, taskId: attempt.taskId, runStatus });
  });
}

async function failEasyModeAttempt(input: FailureInput, status: EasyModeAttemptFailureStatus) {
  const code = safeErrorCode(input.safeErrorCode);
  const allowed: readonly EasyModeTaskAttemptStatus[] = status === "failed_before_dispatch"
    ? ["claimed", "dispatching"]
    : ["dispatching", "running"];
  return db.transaction(async (transaction) => {
    const attempt = await loadLeasedAttempt(transaction, input, allowed);
    const now = new Date();
    const [updated] = await transaction.update(easyModeTaskAttempts).set({
      status, finishedAt: now, safeErrorCode: code,
    }).where(and(eq(easyModeTaskAttempts.id, attempt.id), inArray(easyModeTaskAttempts.status, [...allowed])))
      .returning({ id: easyModeTaskAttempts.id });
    if (!updated) throw new EasyModeAttemptError("INVALID_TRANSITION");
    await transaction.update(easyModeTasks).set({
      status: "failed", failedAt: now, completedAt: null, safeErrorCode: code,
    }).where(and(eq(easyModeTasks.id, attempt.taskId), eq(easyModeTasks.status, "running")));
    const runStatus = await refreshRunStatus(transaction, attempt.runId);
    return Object.freeze({ attemptId: attempt.id, taskId: attempt.taskId, runStatus });
  });
}

export const failEasyModeAttemptBeforeDispatch = (input: FailureInput) =>
  failEasyModeAttempt(input, "failed_before_dispatch");

export const failEasyModeAttemptUncertain = (input: FailureInput) =>
  failEasyModeAttempt(input, "failed_uncertain");

export async function prepareEasyModeTaskRetry(input: Readonly<{ attemptId: string; userId: string }>) {
  const attemptId = validateUuid(input.attemptId);
  if (!attemptId || !input.userId || input.userId.length > 128) throw new EasyModeAttemptError("INVALID_REQUEST");
  return db.transaction(async (transaction) => {
    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
      eq(easyModeTaskAttempts.id, attemptId), eq(easyModeTaskAttempts.userId, input.userId),
    )).limit(1).for("update");
    if (!attempt || !canExplicitlyRetryAttempt(attempt.status)) throw new EasyModeAttemptError("RETRY_NOT_ALLOWED");
    const [task] = await transaction.update(easyModeTasks).set({
      status: "queued", startedAt: null, completedAt: null, failedAt: null, safeErrorCode: null,
    }).where(and(eq(easyModeTasks.id, attempt.taskId), eq(easyModeTasks.status, "failed")))
      .returning({ id: easyModeTasks.id });
    if (!task) throw new EasyModeAttemptError("RETRY_NOT_ALLOWED");
    await transaction.update(easyModeRuns).set({ status: "running", completedAt: null, failedAt: null })
      .where(and(eq(easyModeRuns.id, attempt.runId), eq(easyModeRuns.userId, input.userId)));
    return Object.freeze({ taskId: task.id, retryReady: true as const });
  });
}
