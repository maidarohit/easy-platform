import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEasyModePlan } from "../../app/lib/easy-mode-plans.ts";
import { validateEasyModeRunCreateBody, validateEasyModeRunId } from "../../app/lib/easy-mode-run-validation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const validBody = {
  projectId: "project_123",
  goalId: "build_website",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
};

test("run input accepts canonical goals and rejects malformed IDs, keys, and arbitrary modules", () => {
  assert.deepEqual(validateEasyModeRunCreateBody(validBody), validBody);
  assert.equal(validateEasyModeRunCreateBody({ ...validBody, goalId: "unknown" }), null);
  assert.equal(validateEasyModeRunCreateBody({ ...validBody, projectId: "../other" }), null);
  assert.equal(validateEasyModeRunCreateBody({ ...validBody, idempotencyKey: "short" }), null);
  assert.equal(validateEasyModeRunCreateBody({ ...validBody, modules: ["website"] }), null);
  assert.equal(validateEasyModeRunId("123e4567-e89b-42d3-a456-426614174000"), "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(validateEasyModeRunId("not-a-run"), null);
});

test("server plan creates the correct ordered queued task foundation", () => {
  assert.deepEqual(resolveEasyModePlan("build_everything"), ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"]);
  assert.deepEqual(resolveEasyModePlan("create_content"), ["branding-context", "content", "image"]);
});

test("create route authenticates, verifies ownership, preflights entitlements, and creates transactionally", async () => {
  const route = await source("app/api/easy-mode/runs/route.ts");
  const authAt = route.indexOf("verifyFirebaseIdToken(request)");
  const bodyAt = route.indexOf("readLimitedJson(request");
  assert.ok(authAt >= 0 && bodyAt > authAt);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /resolveEasyModePlan\(body\.goalId\)/);
  assert.match(route, /preflightEasyModePlanQuota\(userId, plan\)/);
  assert.match(route, /db\.transaction/);
  assert.match(route, /plan\.map\(\(moduleId, position\)/);
  assert.match(route, /status: "queued" as const/);
});

test("idempotency is database enforced and duplicate requests cannot duplicate tasks", async () => {
  const schema = await source("app/db/schema.ts");
  const migration = await source("drizzle/0013_add-easy-mode-runs.sql");
  const route = await source("app/api/easy-mode/runs/route.ts");
  assert.match(schema, /easy_mode_runs_owner_project_idempotency_unique/);
  assert.match(schema, /easy_mode_tasks_run_position_unique/);
  assert.match(migration, /CREATE UNIQUE INDEX "easy_mode_runs_owner_project_idempotency_unique"/);
  assert.match(migration, /CREATE UNIQUE INDEX "easy_mode_tasks_run_position_unique"/);
  assert.match(migration, /easy_mode_runs_goal_id_check/);
  assert.match(migration, /easy_mode_tasks_module_id_check/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /if \(!createdRun\) return null/);
  assert.match(route, /if \(existingRun\) return Response\.json/);
});

test("status route is tenant scoped and returns only safe task fields and counts", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /and\(eq\(easyModeRuns\.id, runId\), eq\(easyModeRuns\.userId, userId\)\)/);
  assert.match(route, /and\(eq\(projects\.id, run\.projectId\), eq\(projects\.userId, userId\)\)/);
  assert.match(route, /safeErrorCode: easyModeTasks\.safeErrorCode/);
  assert.match(route, /SAFE_ERROR_CODES\.has\(task\.safeErrorCode\)/);
  assert.match(route, /progress:/);
  assert.doesNotMatch(route, /provider|n8n|stack|internalError|result:/);
});

test("Phase 2 has no AI, n8n, usage write, or website publication execution", async () => {
  const createRoute = await source("app/api/easy-mode/runs/route.ts");
  const statusRoute = await source("app/api/easy-mode/runs/[runId]/route.ts");
  const combined = `${createRoute}\n${statusRoute}`;
  assert.doesNotMatch(combined, /fetch\(|startAiUsage|completeAiUsage|N8N_|website-publications|publishedWebsites/);
  assert.doesNotMatch(combined, /insert\(aiUsage\)|insert\(projectOutputs\)/);
});

test("migration is additive and remains unapplied by implementation", async () => {
  const migration = await source("drizzle/0013_add-easy-mode-runs.sql");
  assert.match(migration, /CREATE TABLE "easy_mode_runs"/);
  assert.match(migration, /CREATE TABLE "easy_mode_tasks"/);
  assert.match(migration, /FOREIGN KEY/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
});
