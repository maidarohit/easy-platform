import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("regeneration derives identity and module from an owner-scoped output", async () => {
  const route = await source("app/api/master-workspace/regenerate/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.id, outputId\)/);
  assert.match(route, /eq\(projectOutputs\.projectId, projectId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /MODULE_ALIASES\[sourceOutput\.module\.toLowerCase\(\)\]/);
  assert.match(route, /validatedWorkspaceOutput\(moduleId, sourceOutput\.result\)/);
  assert.doesNotMatch(route, /values\.module|values\.userId/);
});

test("one source output creates one server-owned canonical regeneration run", async () => {
  const route = await source("app/api/master-workspace/regenerate/route.ts");
  assert.match(route, /workspace-regenerate:\$\{sourceOutput\.id\}/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /easyModeRuns\.userId, easyModeRuns\.projectId, easyModeRuns\.idempotencyKey/);
  assert.ok(route.indexOf("if (priorRun)") < route.indexOf("const allowance = await checkUsageAllowance"));
  assert.match(route, /resolveEasyModePlan\(goalId\)/);
  assert.match(route, /plannedModule === moduleId \? "queued" as const : "skipped" as const/);
  assert.match(route, /checkUsageAllowance/);
  assert.doesNotMatch(route, /startAiUsage|completeAiUsage|N8N_|fetch\(|publish/);
});

test("workspace Ready cards expose no regeneration or execution trigger", async () => {
  const page = await source("app/master-workspace/page.tsx");
  assert.doesNotMatch(page, /\/api\/master-workspace\/regenerate/);
  assert.doesNotMatch(page, /\/api\/easy-mode\/runs\/.*\/execute-next/);
  assert.doesNotMatch(page, /REGENERATE|regenerateOutput|regeneratingOutputId/);
  assert.match(page, /View latest output/);
  assert.match(page, /approveOutput/);
  assert.match(page, /OPEN ADVANCED TOOL/);
  assert.doesNotMatch(page, /\/api\/(branding-ai|logo-ai|content-ai|website-ai|marketing-ai|seo-ai|uiux-ai|sales-ai|analytics-ai|ai-manager)["'`]/);
  assert.doesNotMatch(page, /N8N_|publish/);
});

test("all regenerated output persistence explicitly resets approval", async () => {
  const executor = await source("app/lib/easy-mode-executor.ts");
  const aiManager = await source("app/lib/easy-mode-ai-manager.ts");
  assert.match(executor, /insert\(projectOutputs\)[\s\S]*?approvedAt: null/);
  assert.match(aiManager, /insert\(projectOutputs\)[\s\S]*?approvedAt: null/);
  assert.match(aiManager, /syncEasyModeAiManagerTask/);
});
