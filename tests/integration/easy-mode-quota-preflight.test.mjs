import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateEasyModeQuotaRequirements,
  preflightEasyModePlanQuota,
} from "../../app/lib/easy-mode-quota-preflight.ts";
import { resolveEasyModePlan } from "../../app/lib/easy-mode-plans.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("enough aggregate quota allows the complete server-owned plan", async () => {
  const plan = resolveEasyModePlan("build_everything");
  assert.ok(plan);
  const seen = [];
  const result = await preflightEasyModePlanQuota("user-1", plan, async (_userId, category) => {
    seen.push(category);
    return { ok: true, plan: "pro", category, used: category === "standardAiTasks" ? 44 : 4, limit: category === "standardAiTasks" ? 50 : 5 };
  });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, ["aiManagerRuns", "standardAiTasks"]);
});

test("insufficient aggregate quota blocks before run creation", async () => {
  const plan = resolveEasyModePlan("build_everything");
  assert.ok(plan);
  const result = await preflightEasyModePlanQuota("user-1", plan, async (_userId, category) => ({
    ok: true, plan: "pro", category, used: category === "standardAiTasks" ? 45 : 0, limit: category === "standardAiTasks" ? 50 : 5,
  }));
  assert.equal(result.ok, false);
  assert.equal(result.allowance.reason, "PLAN_LIMIT_REACHED");
  assert.equal(result.requirement.taskCount, 6);
});

test("local and disabled tasks are not charged", () => {
  const plan = resolveEasyModePlan("create_content");
  assert.ok(plan);
  assert.deepEqual(calculateEasyModeQuotaRequirements(plan), [
    { category: "standardAiTasks", taskCount: 1 },
  ]);
});

test("private-beta allowance behavior remains authoritative", async () => {
  const plan = resolveEasyModePlan("build_brand");
  assert.ok(plan);
  let calls = 0;
  const result = await preflightEasyModePlanQuota("beta-user", plan, async (_userId, category) => {
    calls += 1;
    return { ok: true, plan: "pro", category, used: 47, limit: 50 };
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
});

test("preflight is read-only for AI usage and executes no provider or n8n", async () => {
  const helper = await source("app/lib/easy-mode-quota-preflight.ts");
  const preflightRoute = await source("app/api/easy-mode/preflight/route.ts");
  const combined = `${helper}\n${preflightRoute}`;
  assert.doesNotMatch(combined, /insert\(aiUsage\)|startAiUsage|completeAiUsage|fetch\(|N8N_|execute-next/);
  assert.match(preflightRoute, /preflightEasyModePlanQuota\(userId, plan\)/);
});
