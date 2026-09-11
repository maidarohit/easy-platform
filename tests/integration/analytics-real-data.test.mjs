import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { aggregateBusinessAnalytics } from "../../app/lib/analytics-metrics-calculation.ts";
import { sanitizeAnalyticsInsights } from "../../app/lib/analytics-insight-safety.ts";

const route = fs.readFileSync("app/api/analytics-ai/route.ts", "utf8");
const metrics = fs.readFileSync("app/lib/analytics-metrics.ts", "utf8");
const calculation = fs.readFileSync("app/lib/analytics-metrics-calculation.ts", "utf8");
const page = fs.readFileSync("app/analytics-ai/page.tsx", "utf8");
const persistence = fs.readFileSync("app/lib/analytics-generation-persistence.ts", "utf8");
const projectOutputsRoute = fs.readFileSync("app/api/project-outputs/route.ts", "utf8");
const aiUsage = fs.readFileSync("app/lib/ai-usage.ts", "utf8");

test("analytics reads project-owned real business records without visitor fabrication", () => {
  assert.match(metrics, /publicBusinessInquiries/);
  assert.match(metrics, /publicBusinessOrders/);
  assert.match(calculation, /paymentStatus === "paid"/);
  assert.match(route, /loadOwnedBusinessAnalytics\(uid, projectId\)/);
  assert.match(page, /Website Visitors", "Not measured"/);
  assert.doesNotMatch(page, /Monthly Website Visitors/);
});

test("only authoritative paid orders contribute sales and revenue", () => {
  const result = aggregateBusinessAnalytics({
    enquiries: [{}, {}], published: true, publishedUrl: "https://example.test/business/acme",
    orders: [
      { status: "fulfilled", paymentStatus: "paid", totalPaise: 199900 },
      { status: "pending", paymentStatus: "unpaid", totalPaise: 500000 },
      { status: "cancelled", paymentStatus: "refunded", totalPaise: 90000 },
    ],
  });
  assert.deepEqual({ leads: result.enquiries, orders: result.orders, paid: result.paidOrders, fulfilled: result.fulfilledOrders, revenue: result.paidRevenuePaise, conversion: result.enquiryToPaidOrderRate },
    { leads: 2, orders: 3, paid: 1, fulfilled: 1, revenue: 199900, conversion: 50 });
  assert.equal(result.visitors, null);
  assert.equal(result.visitorsStatus, "not_measured");
});

test("analytics generation persists before successful usage completion", () => {
  assert.match(route, /persistCompletedAnalyticsGeneration/);
  assert.match(persistence, /transaction\.update\(projectOutputs\)/);
  assert.match(persistence, /eq\(aiUsage\.status, "started"\)/);
  assert.match(persistence, /status: "success"/);
  assert.match(route, /Your allowance was restored/);
  assert.doesNotMatch(page, /method: "POST"[\s\S]{0,200}\/api\/project-outputs/);
});

test("analytics GET is owner-scoped, no-store, and does not start usage", () => {
  const getSection = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getSection, /verifyFirebaseIdToken/);
  assert.match(getSection, /private, no-store/);
  assert.doesNotMatch(getSection, /claimIdempotentAiUsage|fetch\(webhook/);
  assert.match(metrics, /eq\(projects\.userId, userId\)/);
});

test("analytics viewing remains available after the AI ceiling while new Analytics AI generation stays blocked", () => {
  const getSection = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  const postSection = route.slice(route.indexOf("export async function POST"));
  const projectOutputsGetSection = projectOutputsRoute.slice(projectOutputsRoute.indexOf("export async function GET"));
  const claimSection = aiUsage.slice(aiUsage.indexOf("export async function claimIdempotentAiUsage"));

  assert.match(page, /authenticatedFetch\(`\/api\/analytics-ai\?projectId=/);
  assert.match(page, /authenticatedFetch\(\s*`\/api\/project-outputs\?projectId=/);
  assert.doesNotMatch(page, /useEffect[\s\S]{0,400}method:\s*"POST"[\s\S]{0,400}\/api\/analytics-ai/);

  assert.match(getSection, /loadOwnedBusinessAnalytics\(uid, projectId\)/);
  assert.doesNotMatch(getSection, /claimIdempotentAiUsage|startAiUsage|requireBusinessPlanGenerationHeadroom|fetch\(webhook/);

  assert.match(projectOutputsGetSection, /verifyFirebaseIdToken/);
  assert.match(projectOutputsGetSection, /moduleName = searchParams\.get\("module"\)/);
  assert.doesNotMatch(projectOutputsGetSection, /claimIdempotentAiUsage|startAiUsage|requireBusinessPlanGenerationHeadroom/);

  assert.match(postSection, /claimIdempotentAiUsage\(/);
  assert.match(postSection, /module: "analytics"/);
  assert.match(postSection, /fetch\(webhook\.url/);

  const headroom = claimSection.indexOf("requireBusinessPlanGenerationHeadroom(input.userId, input.module)");
  const insert = claimSection.indexOf(".insert(aiUsage)");
  assert.ok(headroom >= 0 && headroom < insert);
});

test("unsupported quantified analytics claims cannot reach saved output", () => {
  assert.deepEqual(sanitizeAnalyticsInsights({ trafficAnalysis: "Traffic will grow 40%. Visitor data is unavailable.", actionPlan90Days: "Review results after 90 days." }), {
    trafficAnalysis: "Visitor data is unavailable.", actionPlan90Days: "Review results after 90 days.",
  });
  assert.match(route, /sanitizeAnalyticsInsights\(rawInsights\)/);
});
