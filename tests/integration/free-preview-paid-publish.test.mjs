import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { freePreviewBuildsEnabled, mayUseFreePreviewBuild } from "../../app/lib/free-preview-entitlement.ts";
import { statusGrantsPaidAccess } from "../../app/lib/subscription-policy.ts";

const source = (path) => readFile(path, "utf8");

test("free verified customer receives exactly one preview build", () => {
  assert.equal(mayUseFreePreviewBuild({ paidAllowed: false, denialReason: "PAID_SUBSCRIPTION_REQUIRED", existingBuilds: 0 }), true);
  assert.equal(mayUseFreePreviewBuild({ paidAllowed: false, denialReason: "PAID_SUBSCRIPTION_REQUIRED", existingBuilds: 1 }), false);
  assert.equal(mayUseFreePreviewBuild({ paidAllowed: false, denialReason: "PAID_FEATURE_UNAVAILABLE", existingBuilds: 0 }), true);
  assert.equal(freePreviewBuildsEnabled(undefined), true);
  assert.equal(freePreviewBuildsEnabled("false"), false);
});

test("only active subscription status grants ordinary paid access", () => {
  assert.equal(statusGrantsPaidAccess("active"), true);
  for (const status of [null, "pending", "past_due", "cancelled", "expired"]) assert.equal(statusGrantsPaidAccess(status), false);
});

test("business publishing and both public routes enforce paid product access server-side", async () => {
  const [businessApi, businessPage, websiteApi, websitePage] = await Promise.all([source("app/api/business-publications/route.ts"), source("app/business/[slug]/page.tsx"), source("app/api/website-publications/route.ts"), source("app/published-sites/[slug]/page.tsx")]);
  assert.match(businessApi, /requirePaidProductAccess/); assert.match(businessPage, /hasPaidProductAccess/);
  assert.match(websiteApi, /requirePaidProductAccess/); assert.match(websitePage, /hasPaidProductAccess/);
});

test("private preview shows watermark and never renders a free public URL", async () => {
  const [page, api] = await Promise.all([source("app/business-preview/page.tsx"), source("app/api/business-publications/route.ts")]);
  assert.match(page, /Buzypeezy Preview — Subscribe to Publish/); assert.match(page, /Subscribe to Publish/);
  assert.match(api, /!canPublish.*publicUrl: undefined/);
});

test("weekly report reads, delivery changes and cron deliveries require paid access", async () => {
  const [report, delivery, cron] = await Promise.all([source("app/api/reports/route.ts"), source("app/api/reports/delivery/route.ts"), source("app/api/cron/weekly-reports/route.ts")]);
  assert.match(report, /requirePaidProductAccess/); assert.match(delivery, /requirePaidProductAccess/); assert.match(cron, /hasPaidProductAccess/);
});

test("automation execution remains paid and exports are authorized server-side", async () => {
  const [automationAuth, download, exportRoute, content, automation] = await Promise.all([source("app/lib/automation-auth.ts"), source("app/lib/paid-download.ts"), source("app/api/exports/route.ts"), source("app/dashboard/content-ai/page.tsx"), source("app/dashboard/automation/page.tsx")]);
  assert.match(automationAuth, /requirePaidEntitlement\(userId, "automationRuns"\)/);
  assert.match(exportRoute, /requirePaidProductAccess/); assert.match(exportRoute, /if \(!paid\.ok\) return paid\.response/);
  assert.match(download, /authenticatedFetch\("\/api\/exports"/); assert.match(content, /downloadPaidBlob/); assert.match(automation, /downloadPaidBlob/);
});

test("saved project and preview read paths are not paid-gated", async () => {
  const [projects, preview, workspace] = await Promise.all([source("app/api/projects/route.ts"), source("app/api/business-preview/route.ts"), source("app/api/master-workspace/route.ts")]);
  const projectGet = projects.slice(projects.indexOf("export async function GET"));
  assert.doesNotMatch(projectGet, /requirePaidProductAccess|hasPaidProductAccess/);
  assert.doesNotMatch(`${preview}\n${workspace}`, /requirePaidProductAccess|hasPaidProductAccess/);
});

test("boss and existing private-beta identities remain bypasses", async () => {
  const paid = await source("app/lib/paid-entitlements.ts");
  assert.match(paid, /isBossAdmin\(userId\) \|\| isPrivateBetaUser/);
  assert.match(paid, /PRIVATE_BETA_UIDS/);
});
