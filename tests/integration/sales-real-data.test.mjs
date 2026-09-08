import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStoredSalesInsights, sanitizeSalesInsights } from "../../app/lib/sales-insight-safety.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const metrics = {
  published: true, publishedUrl: "https://buzypeezy.ai/business/example",
  visitors: null, visitorsStatus: "not_measured", enquiries: 2, orders: 3,
  paidOrders: 1, fulfilledOrders: 1, paidRevenuePaise: 199900,
  currency: "INR", enquiryToPaidOrderRate: 50,
};

test("Sales context reuses owned publication, services, location, enquiry and order facts", async () => {
  const context = await source("app/lib/sales-business-context.ts");
  assert.match(context, /loadOwnedBusinessAnalytics/);
  assert.match(context, /loadOwnedMarketingContext/);
  const route = await source("app/api/sales-ai/route.ts");
  for (const fact of ["website", "location", "services", "enquiries", "orders", "paidOrders", "paidRevenuePaise", "currency", "enquiryToPaidOrderRate"]) assert.match(route, new RegExp(`\\b${fact}\\b`));
  assert.match(route, /loadOwnedSalesContext\(uid, projectId\)/);
});

test("Sales safety keeps verified results and removes fabricated commercial claims", () => {
  const result = sanitizeSalesInsights({
    summary: "Verified paid revenue is INR 1,999 from 1 paid order. Revenue will increase by 40%. Guarantee 20 new customers. Target 50 leads. Use a ₹25,000 package. Improve the enquiry process.",
  }, metrics);
  assert.match(result.summary, /INR 1,999 from 1 paid order/);
  assert.match(result.summary, /Improve the enquiry process/);
  assert.doesNotMatch(result.summary, /increase by 40|Guarantee|Target 50|25,000/);
});

test("saved Sales output is normalized on authenticated GET without generation", async () => {
  const restored = readStoredSalesInsights(JSON.stringify({ output: { executiveSummary: "Use the 2 verified enquiries. Forecast 100 sales." } }), metrics);
  assert.equal(restored.executiveSummary, "Use the 2 verified enquiries.");
  const route = await source("app/api/sales-ai/route.ts");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(get, /verifyFirebaseIdToken/);
  assert.match(get, /eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, uid\)[\s\S]*eq\(projectOutputs\.module, "sales"\)/);
  assert.match(get, /orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\)\)/);
  assert.match(get, /readStoredSalesInsights/);
  assert.doesNotMatch(get, /claimIdempotentAiUsage|fetch\(webhook\.url/);
});

test("Sales persistence and usage completion are one owner-scoped transaction", async () => {
  const [route, persistence, page] = await Promise.all([
    source("app/api/sales-ai/route.ts"), source("app/lib/sales-generation-persistence.ts"), source("app/sales-ai/page.tsx"),
  ]);
  assert.match(route, /claimIdempotentAiUsage/);
  assert.match(route, /requestId/);
  assert.ok(route.indexOf("await persistCompletedSalesGeneration") < route.indexOf("return NextResponse.json({ salesContext: context, salesStrategy })", route.indexOf("export async function POST")));
  assert.match(persistence, /db\.transaction/);
  assert.match(persistence, /eq\(projects\.userId, input\.userId\)/);
  assert.match(persistence, /(?:insert|update)\(projectOutputs\)/);
  assert.match(persistence, /update\(aiUsage\)[\s\S]*status: "success"[\s\S]*eq\(aiUsage\.status, "started"\)/);
  assert.match(route, /releaseFailedAiUsage/);
  assert.match(page, /\/api\/sales-ai\?projectId=/);
  assert.match(page, /data\.salesStrategy/);
  assert.doesNotMatch(page, /authenticatedFetch\("\/api\/project-outputs"|userId:\s*project\.userId/);
});
