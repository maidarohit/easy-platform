import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EASY_MODE_GOALS, mapExistingGoal } from "../../app/lib/easy-mode-goal-options.ts";
import { resolveEasyModePlan } from "../../app/lib/easy-mode-plans.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Easy Mode exposes exactly six canonical goals with server-owned plans", () => {
  assert.deepEqual(EASY_MODE_GOALS.map((goal) => goal.id), [
    "build_everything", "build_website", "get_customers",
    "build_brand", "create_content", "improve_business",
  ]);
  assert.deepEqual(resolveEasyModePlan("build_website"), ["branding-context", "website", "seo", "uiux"]);
  assert.deepEqual(resolveEasyModePlan("get_customers"), ["marketing", "sales", "seo", "content"]);
  assert.equal(resolveEasyModePlan("website,admin"), null);
  assert.equal(resolveEasyModePlan(["website"]), null);
});

test("legacy onboarding goals map safely to canonical goals", () => {
  assert.equal(mapExistingGoal("Build my business"), "build_everything");
  assert.equal(mapExistingGoal("Get more customers"), "get_customers");
  assert.equal(mapExistingGoal("Improve my online presence"), "build_website");
  assert.equal(mapExistingGoal("Increase sales"), "get_customers");
  assert.equal(mapExistingGoal("Launch something new"), "build_everything");
  assert.equal(mapExistingGoal("Guide me"), "improve_business");
});

test("Phase 1 preflight preserves ownership and cannot execute AI, n8n, or publishing", async () => {
  const route = await source("app/api/easy-mode/preflight/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /and\(eq\(projects\.id, body\.projectId\), eq\(projects\.userId, userId\)\)/);
  assert.match(route, /resolveEasyModePlan\(body\.goalId\)/);
  assert.doesNotMatch(route, /fetch\(|n8n|website-publications|projectOutputs|aiManagerJobs/);
});

test("onboarding and dashboard route customers into Easy Mode", async () => {
  const onboarding = await source("app/onboarding/page.tsx");
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(onboarding, /\/easy-mode\?projectId=/);
  assert.match(dashboard, /Continue Building/);
  assert.match(dashboard, /\/easy-mode\?projectId=/);
});
