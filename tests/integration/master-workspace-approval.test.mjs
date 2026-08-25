import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("migration 0015 adds only the nullable project output approval timestamp", async () => {
  const migration = (await source("drizzle/0015_add-project-output-approval.sql")).trim();
  assert.equal(migration, 'ALTER TABLE "project_outputs" ADD COLUMN "approved_at" timestamp with time zone;');
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE|NOT NULL/i);
});

test("approval is authenticated, owner scoped, generated-only, and idempotent", async () => {
  const route = await source("app/api/master-workspace/approve/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.projectId, projectId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /validatedWorkspaceOutput\(moduleId, output\.result\)/);
  assert.match(route, /if \(output\.approvedAt\)/);
  assert.match(route, /isNull\(projectOutputs\.approvedAt\)/);
  assert.doesNotMatch(route, /userId\s*=\s*values\.|startAiUsage|N8N_|publish/);
});

test("replacement output clears approval and workspace exposes review controls", async () => {
  const outputRoute = await source("app/api/project-outputs/route.ts");
  const workspaceRoute = await source("app/api/master-workspace/route.ts");
  const page = await source("app/master-workspace/page.tsx");
  assert.match(outputRoute, /approvedAt: null/);
  assert.match(workspaceRoute, /"Approved" : "Needs review"/);
  assert.match(page, /\/api\/master-workspace\/approve/);
  assert.match(page, /APPROVE/);
  assert.doesNotMatch(page, /REGENERATE|regenerate/i);
});
