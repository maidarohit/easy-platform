import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWeeklyBusinessReport, weeklyReportWindow } from "../../app/lib/weekly-business-report.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("weekly windows are exact Monday-to-Monday UTC boundaries", () => {
  const current = weeklyReportWindow(new Date("2026-08-27T15:30:00Z"), "current");
  assert.equal(current.start.toISOString(), "2026-08-24T00:00:00.000Z");
  assert.equal(current.end.toISOString(), "2026-08-31T00:00:00.000Z");
  const previous = weeklyReportWindow(new Date("2026-08-24T00:00:00Z"), "previous");
  assert.equal(previous.start.toISOString(), "2026-08-17T00:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-08-24T00:00:00.000Z");
});

test("real saved project, social, publication, usage and billing facts are presented", () => {
  const report = buildWeeklyBusinessReport({ projectName: "BrightReach Digital", dnaConfirmed: true, latestRunStatus: "completed", outputModules: ["branding", "website"], outputActivity: ["website"], previewApproved: true, publicationStatus: "active", socialCounts: { proposed: 1, approved: 2, skipped: 1, published: 0, failed: 0 }, connectedSocialChannels: 1, todaysSocialStatus: "proposed", aiRequestCount: 7, subscriptionStatus: "active" }, "current");
  assert.equal(report.summary.publication, "Published");
  assert.equal(report.summary.aiRequests, 7);
  assert.match(report.completedActions.join(" "), /Website output saved/);
  assert.match(report.attention.join(" "), /waiting for review/);
});

test("deterministic actions reflect missing approval, publication and social setup", () => {
  const base = { projectName: "Business", dnaConfirmed: true, latestRunStatus: "completed", outputModules: ["website"], outputActivity: [], previewApproved: false, publicationStatus: "unpublished", socialCounts: { proposed: 0, approved: 0, skipped: 0, published: 0, failed: 0 }, connectedSocialChannels: 0, todaysSocialStatus: null, aiRequestCount: 0, subscriptionStatus: null };
  const report = buildWeeklyBusinessReport(base, "current");
  assert.deepEqual(report.nextActions.map((item) => item.label), ["Review your business", "Connect a social channel"]);
  assert.equal(report.empty, true);
});

test("route is owner scoped, preserves projectId and contains no fabricated metrics or generation", async () => {
  const [route, page, workspace] = await Promise.all([source("app/api/reports/route.ts"), source("app/reports/page.tsx"), source("app/master-workspace/page.tsx")]);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /eq\(socialDailyPosts\.userId, userId\)/);
  assert.match(page, /encodeURIComponent\(projectId\)/);
  assert.match(workspace, /projectLink\("\/reports"\)/);
  assert.doesNotMatch(`${route}\n${page}`, /revenue|conversion|visitor|social reach|ROI|sales number/i);
  assert.doesNotMatch(`${route}\n${page}`, /OpenAI|N8N_|business-build|business-dna\/analyze|insert\(|update\(|delete\(/i);
});
