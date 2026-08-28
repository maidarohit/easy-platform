import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canExplicitlyRetryAttempt,
  deriveEasyModeRunStatus,
  validateLeaseToken,
} from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("attempt schema and migration provide durable ownership, linkage, and status fields", async () => {
  const schema = await source("app/db/schema.ts");
  const migration = await source("drizzle/0014_add-easy-mode-task-attempts.sql");
  for (const field of [
    "task_id", "run_id", "user_id", "project_id", "attempt_number", "execution_key",
    "usage_id", "provider_execution_id", "lease_token", "lease_expires_at",
    "started_at", "finished_at", "safe_error_code", "created_at",
  ]) assert.match(migration, new RegExp(`"${field}"`));
  assert.match(schema, /EasyModeTaskAttemptStatus/);
  assert.match(migration, /'claimed','dispatching','running','completed','failed_before_dispatch','failed_uncertain'/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
});

test("database constraints enforce attempt, execution, usage, and active-run uniqueness", async () => {
  const migration = await source("drizzle/0014_add-easy-mode-task-attempts.sql");
  assert.match(migration, /easy_mode_task_attempts_task_number_unique[^\n]+"task_id","attempt_number"/);
  assert.match(migration, /easy_mode_task_attempts_execution_key_unique[^\n]+"execution_key"/);
  assert.match(migration, /easy_mode_task_attempts_usage_id_unique[^\n]+"usage_id"/);
  assert.match(migration, /easy_mode_task_attempts_one_active_per_run_unique[^\n]+WHERE[^\n]+'claimed','dispatching','running'/);
  assert.match(migration, /usage_id_ai_usage_id_fk/);
});

test("claim is tenant-scoped, run-locked, plan-revalidated, and transactional", async () => {
  const claim = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(claim, /db\.transaction/);
  assert.match(claim, /eq\(easyModeRuns\.userId, input\.userId\)/);
  assert.match(claim, /eq\(projects\.userId, input\.userId\)/);
  assert.match(claim, /\.for\("update"\)/);
  assert.match(claim, /resolveEasyModePlan\(run\.goalId\)/);
  assert.match(claim, /task\.moduleId !== plan\[position\]/);
  assert.match(claim, /inArray\(easyModeTaskAttempts\.status/);
  assert.match(claim, /candidate\.status === "queued"/);
  assert.match(claim, /adapter\.executionSupport === "unsupported"/);
  assert.match(claim, /attemptCount: attemptNumber/);
  assert.match(claim, /status: "running"/);
  assert.match(claim, /createTrustedModuleExecutionContext/);
});

test("second claims and completed tasks have no eligible claim path", async () => {
  const claim = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(claim, /if \(activeAttempt\)/);
  assert.match(claim, /isRecoverablePreDispatchClaim/);
  assert.match(claim, /if \(!recoverable\)/);
  assert.match(claim, /\["completed", "failed", "cancelled"\]\.includes\(run\.status\)/);
  assert.doesNotMatch(claim, /candidate\.status === "completed"/);
});

test("lease token validation and finalization require a live matching lease", async () => {
  const valid = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(validateLeaseToken(valid), valid);
  assert.equal(validateLeaseToken("wrong-worker"), null);
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(attempts, /eq\(easyModeTaskAttempts\.leaseToken, leaseToken\)/);
  assert.match(attempts, /gt\(easyModeTaskAttempts\.leaseExpiresAt, new Date\(\)\)/);
  assert.match(attempts, /throw new EasyModeAttemptError\("LEASE_INVALID"\)/);
  assert.match(attempts, /completeEasyModeAttempt/);
});

test("usage binding is idempotent, tenant/project-bound, and rejects conflicts", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(attempts, /usage\.userId !== input\.userId/);
  assert.match(attempts, /usage\.projectId !== attempt\.projectId/);
  assert.match(attempts, /attempt\.usageId === usageId/);
  assert.match(attempts, /if \(attempt\.usageId\) throw new EasyModeAttemptError\("USAGE_CONFLICT"\)/);
  assert.match(attempts, /eq\(easyModeTaskAttempts\.usageId, usageId\)/);
  assert.doesNotMatch(attempts, /startAiUsage|insert\(aiUsage\)/);
});

test("failure classes distinguish retry-safe and uncertain attempts", () => {
  assert.equal(canExplicitlyRetryAttempt("failed_before_dispatch"), true);
  assert.equal(canExplicitlyRetryAttempt("failed_uncertain"), false);
  assert.equal(canExplicitlyRetryAttempt("completed"), false);
});

test("run status preserves partial completion", () => {
  assert.equal(deriveEasyModeRunStatus(["completed", "failed", "queued"]), "partially_completed");
  assert.equal(deriveEasyModeRunStatus(["failed", "queued"]), "failed");
  assert.equal(deriveEasyModeRunStatus(["completed", "completed"]), "completed");
  assert.equal(deriveEasyModeRunStatus(["completed", "queued"]), "running");
});

test("uncertain work has no automatic requeue path", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  assert.match(attempts, /canExplicitlyRetryAttempt\(attempt\.status\)/);
  assert.match(attempts, /status === "failed_before_dispatch"/);
  assert.doesNotMatch(attempts, /failed_uncertain[^\n]+status: "queued"/);
});

test("status API exposes no attempt execution internals", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/route.ts");
  assert.doesNotMatch(route, /easyModeTaskAttempts|leaseToken|leaseExpiresAt|executionKey|usageId|providerExecutionId/);
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
});

test("Phase 3B has zero AI, n8n, usage charge, output persistence, and publication calls", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  assert.doesNotMatch(attempts, /\bfetch\s*\(|N8N_|startAiUsage|completeAiUsage|failAiUsage/);
  assert.doesNotMatch(attempts, /insert\(projectOutputs\)|publishedWebsites|website-publications/);
});
