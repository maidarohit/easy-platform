import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWeeklyBusinessReport, nextWeeklyDeliveryAt, weeklyReportWindow } from "../../app/lib/weekly-business-report.ts";
import { weeklyReportMessage } from "../../app/lib/weekly-report-delivery.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("weekly windows are exact Monday-to-Monday UTC boundaries", () => {
  const current = weeklyReportWindow(new Date("2026-08-27T15:30:00Z"), "current");
  assert.equal(current.start.toISOString(), "2026-08-24T00:00:00.000Z");
  assert.equal(current.end.toISOString(), "2026-08-31T00:00:00.000Z");
  const previous = weeklyReportWindow(new Date("2026-08-24T00:00:00Z"), "previous");
  assert.equal(previous.start.toISOString(), "2026-08-17T00:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-08-24T00:00:00.000Z");
  assert.equal(nextWeeklyDeliveryAt(new Date("2026-08-27T00:00:00Z")).toISOString(), "2026-08-31T03:30:00.000Z");
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

test("email and WhatsApp preview is composed only from the stored report", () => {
  const built = buildWeeklyBusinessReport({ projectName: "Saved Business", dnaConfirmed: true, latestRunStatus: "completed", outputModules: ["website"], outputActivity: ["website"], previewApproved: true, publicationStatus: "active", socialCounts: { proposed: 1, approved: 0, skipped: 0, published: 0, failed: 0 }, connectedSocialChannels: 1, todaysSocialStatus: null, aiRequestCount: 0, subscriptionStatus: null }, "previous");
  const message = weeklyReportMessage({ ...built, period: { start: "2026-08-17T00:00:00.000Z", end: "2026-08-24T00:00:00.000Z" }, social: { proposed: 1, approved: 0, skipped: 0, published: 0 } }, "https://buzypeezy.ai/reports?projectId=saved");
  assert.match(message, /Website output saved/); assert.match(message, /Publication: Published/); assert.match(message, /proposed/); assert.match(message, /View Full Report/);
  assert.doesNotMatch(message, /revenue|leads|ROI|reach/i);
});

test("route is owner scoped, preserves projectId and contains no fabricated metrics or generation", async () => {
  const [route, data, page, workspace] = await Promise.all([source("app/api/reports/route.ts"), source("app/lib/weekly-report-data.ts"), source("app/reports/page.tsx"), source("app/master-workspace/page.tsx")]);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(data, /eq\(projects\.userId, userId\)/);
  assert.match(data, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(data, /eq\(socialDailyPosts\.userId, userId\)/);
  assert.match(page, /encodeURIComponent\(projectId\)/);
  assert.match(workspace, /projectLink\("\/reports"\)/);
  assert.doesNotMatch(`${route}\n${data}\n${page}`, /revenue|conversion|visitor|social reach|ROI|sales number/i);
  assert.doesNotMatch(`${route}\n${data}\n${page}`, /OpenAI|N8N_|business-build|business-dna\/analyze|insert\(|update\(|delete\(/i);
});

test("delivery is both-channel, independently tracked, idempotent and fail-closed", async () => {
  const [cron, delivery, schema, migration, config] = await Promise.all([source("app/api/cron/weekly-reports/route.ts"), source("app/api/reports/delivery/route.ts"), source("app/db/schema.ts"), source("drizzle/0020_add-weekly-report-delivery.sql"), source("vercel.json")]);
  assert.match(config, /30 3 \* \* 1/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /channel: "email"/); assert.match(cron, /channel: "whatsapp"/);
  assert.match(cron, /existing\?\.status === "delivered" \|\| existing\?\.status === "pending"/);
  assert.match(cron, /eq\(weeklyReportDeliveries\.status, "failed"\)/);
  assert.match(schema, /weekly_report_deliveries_project_week_channel_unique/);
  assert.match(migration, /UNIQUE \("project_id", "week_start", "channel"\)/);
  assert.match(delivery, /verifyFirebaseIdToken/); assert.match(delivery, /eq\(projects\.userId, token\.uid\)/);
  assert.match(delivery, /preference\?\.enabled \?\? true/);
});

test("off disables both and unavailable WhatsApp does not block email", async () => {
  const cron = await source("app/api/cron/weekly-reports/route.ts");
  assert.match(cron, /preference\?\.enabled === false/);
  assert.match(cron, /const email = identity\.email && config\.email/);
  assert.match(cron, /const whatsapp = identity\.phoneNumber && preference\?\.whatsappOptInAt && config\.whatsapp/);
  assert.ok(cron.indexOf("const email =") < cron.indexOf("const whatsapp ="));
  assert.doesNotMatch(cron, /OpenAI|N8N_|business-build|business-dna\/analyze/i);
});
