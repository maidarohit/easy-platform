import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RECOVERY_PROJECT_ID, RECOVERY_RUN_ID, RECOVERY_SALES_TASK_ID, validateClaimedSalesRecovery } from "../../app/lib/boss-sales-claimed-recovery.ts";

const owner = "boss-owner";
const tasks = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"].map((moduleId, position) => ({ id: moduleId === "sales" ? RECOVERY_SALES_TASK_ID : `task-${position}`, moduleId, position, status: moduleId === "sales" ? "running" : "completed", projectOutputId: moduleId === "sales" ? null : `output-${position}` }));
const evidence = { run: { id: RECOVERY_RUN_ID, projectId: RECOVERY_PROJECT_ID, userId: owner, status: "running", createdAt: new Date() }, projectOwnerId: owner, tasks, attempt: { id: "attempt", taskId: RECOVERY_SALES_TASK_ID, runId: RECOVERY_RUN_ID, projectId: RECOVERY_PROJECT_ID, userId: owner, status: "claimed", providerExecutionId: null, usageId: null }, salesOutputsSinceRun: 0 };

test("accepts only the exact pre-dispatch stranded Sales claim", () => assert.deepEqual(validateClaimedSalesRecovery(evidence, owner), { valid: true, runStatus: "running", salesStatus: "running", attemptStatus: "claimed", completedTasks: 6, preDispatch: true }));
test("fails closed for wrong identity, run, project, task or ownership", () => {
  assert.equal(validateClaimedSalesRecovery(evidence, "other"), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, run: { ...evidence.run, id: "wrong" } }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, run: { ...evidence.run, projectId: "wrong" } }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, projectOwnerId: "other" }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, attempt: { ...evidence.attempt, taskId: "wrong" } }, owner), null);
});
test("exact project owner or configured boss is authorized, nobody else is", () => {
  assert.ok(validateClaimedSalesRecovery(evidence, owner, false));
  assert.ok(validateClaimedSalesRecovery(evidence, "configured-boss", true));
  assert.equal(validateClaimedSalesRecovery(evidence, "unrelated-user", false), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, projectOwnerId: "different-owner" }, "configured-boss", true), null);
});
test("rejects any dispatched, charged, output-bearing or non-claimed attempt", () => {
  for (const change of [{ providerExecutionId: "123" }, { usageId: "usage" }, { status: "dispatching" }, { status: "running" }]) assert.equal(validateClaimedSalesRecovery({ ...evidence, attempt: { ...evidence.attempt, ...change } }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, salesOutputsSinceRun: 1 }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, tasks: tasks.map((item) => item.moduleId === "sales" ? { ...item, projectOutputId: "output" } : item) }, owner), null);
});
test("rejects any change to the six completed modules or Sales position/status", () => {
  assert.equal(validateClaimedSalesRecovery({ ...evidence, tasks: tasks.map((item) => item.moduleId === "uiux" ? { ...item, status: "running" } : item) }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, tasks: tasks.map((item) => item.moduleId === "sales" ? { ...item, status: "queued" } : item) }, owner), null);
  assert.equal(validateClaimedSalesRecovery({ ...evidence, tasks: tasks.map((item) => item.moduleId === "sales" ? { ...item, position: 5 } : item) }, owner), null);
});
test("server recovery uses locked existing transitions and invokes only one normal Sales task", async () => {
  const [service, route] = await Promise.all([readFile("app/lib/boss-sales-claimed-recovery.ts", "utf8"), readFile("app/api/internal/easy-mode/recover-claimed-sales/route.ts", "utf8")]);
  assert.match(service, /pg_advisory_xact_lock/); assert.match(service, /\.for\("update"\)/); assert.match(service, /failed_before_dispatch/); assert.match(service, /status: "queued"/);
  assert.match(route, /isBossAdmin/); assert.match(route, /executeNextEasyModeTask/); assert.equal((route.match(/executeNextEasyModeTask\(/g) ?? []).length, 1);
  assert.doesNotMatch(`${service}\n${route}`, /executeEasyModeRun|business-build|OPENAI|N8N_|ai-manager.*execute|branding.*execute|uiux.*execute/i);
});
test("boss page has synchronous one-use guard and separate read-only validation", async () => {
  const page = await readFile("app/boss/recover-claimed-sales/page.tsx", "utf8");
  assert.match(page, /Validate recovery/); assert.match(page, /Recover &amp; run Sales once/); assert.match(page, /inFlight\.current = true/); assert.match(page, /sent\.current = true/);
  assert.equal((page.match(/method: "POST"/g) ?? []).length, 1); assert.doesNotMatch(page, /business-build|execute-next|OPENAI|N8N_/i);
});
