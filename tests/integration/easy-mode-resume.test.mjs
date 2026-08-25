import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateEasyModeProjectId } from "../../app/lib/easy-mode-run-validation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("resume lookup validates project IDs and is tenant-owned and read-only", async () => {
  assert.equal(validateEasyModeProjectId("project_123"), "project_123");
  assert.equal(validateEasyModeProjectId("../another-user"), null);
  const route = await source("app/api/easy-mode/runs/route.ts");
  const getRoute = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getRoute, /verifyFirebaseIdToken\(request\)/);
  assert.match(getRoute, /eq\(projects\.userId, userId\)/);
  assert.match(getRoute, /eq\(easyModeRuns\.userId, userId\)/);
  assert.match(getRoute, /eq\(easyModeRuns\.projectId, projectId\)/);
  assert.match(getRoute, /inArray\(easyModeRuns\.status, \["queued", "running"\]\)/);
  assert.match(getRoute, /orderBy\(desc\(easyModeRuns\.createdAt\)\)/);
  assert.doesNotMatch(getRoute, /insert\(|update\(|startAiUsage|fetch\(|N8N_|execute-next/);
});

test("refresh restores the existing run and renders persisted task statuses", async () => {
  const page = await source("app/easy-mode/page.tsx");
  const loadEffect = page.slice(page.indexOf("useEffect(() =>"), page.indexOf("async function handlePreflight"));
  assert.match(loadEffect, /api\/easy-mode\/runs\?projectId=/);
  assert.match(loadEffect, /setRunView\(runData as EasyModeRunView\)/);
  assert.match(loadEffect, /setReady\(true\)/);
  assert.doesNotMatch(loadEffect, /method:\s*"POST"|execute-next|crypto\.randomUUID|handlePreflight/);
  assert.match(page, /taskStatusLabel\(task\.status\)/);
  assert.match(page, /status === "completed"\) return "Completed"/);
  assert.match(page, /return "Waiting"/);
});
