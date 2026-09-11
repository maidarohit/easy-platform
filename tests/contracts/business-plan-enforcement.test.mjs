import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("paid AI usage checks entitlement and the internal cost ceiling before reserving usage", async () => {
  const contents = await source("app/lib/ai-usage.ts");
  const guard = contents.indexOf("requirePaidModule(userId, module)");
  const cost = contents.indexOf("requireBusinessPlanGenerationHeadroom(userId, module)");
  const insert = contents.indexOf(".insert(aiUsage)");
  assert.ok(guard >= 0 && guard < cost && cost < insert);
  assert.match(contents, /throw headroom\.response/);
  assert.match(contents, /requireBusinessPlanGenerationHeadroom\(input\.userId, input\.module\)/);
});

test("manual business preview edits no longer consume paid AI allowance", async () => {
  const contents = await source("app/api/business-preview/edits/route.ts");
  assert.doesNotMatch(contents, /startAiUsage|completeAiUsage|claimIdempotentAiUsage|releaseFailedAiUsage/);
});

test("billing status and billing UI expose friendly usage counters without raw token or cost fields", async () => {
  const [route, page] = await Promise.all([
    source("app/api/billing/status/route.ts"),
    source("app/billing/page.tsx"),
  ]);
  assert.match(route, /getBusinessPlanUsageSnapshot/);
  assert.match(route, /aiThisMonth/);
  assert.match(route, /notifications/);
  assert.doesNotMatch(route, /inputTokens|outputTokens|estimatedCostUsd|measuredCostUsd|measuredCostInr/);
  assert.match(page, /AI Usage This Month/);
  assert.match(page, /used/);
  assert.match(page, /remaining/);
  assert.doesNotMatch(page, /estimatedCostUsd|measuredCostUsd|measuredCostInr|inputTokens|outputTokens/);
});

test("dashboard notifications reuse the billing status payload instead of a separate quota system", async () => {
  const navbar = await source("app/dashboard/components/Navbar.tsx");
  assert.match(navbar, /authenticatedFetch\("\/api\/billing\/status"/);
  assert.match(navbar, /data\.usage\?\.notifications/);
  assert.match(navbar, /Notifications/);
});

test("usage snapshot stays owner-scoped and the cost ceiling does not change non-AI publication access", async () => {
  const [usage, publication] = await Promise.all([
    source("app/lib/business-plan-usage.ts"),
    source("app/api/business-publications/route.ts"),
  ]);
  assert.match(usage, /resolveSubscriptionBillingDetails/);
  assert.match(usage, /legacy_india_fallback/);
  assert.match(usage, /BUSINESS_PLAN_MARKET_LIMITS/);
  assert.match(usage, /BUSINESS_PLAN_COST_POLICIES/);
  assert.match(usage, /eq\(aiUsage\.userId, userId\)/);
  assert.match(usage, /eq\(projects\.userId, userId\)/);
  assert.match(usage, /eq\(publishedWebsites\.ownerUid, userId\)/);
  assert.match(usage, /eq\(businessPublications\.userId, userId\)/);
  assert.match(publication, /requirePaidProductAccess\(uid\)/);
  assert.doesNotMatch(publication, /requireBusinessPlanGenerationHeadroom/);
});
