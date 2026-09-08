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
const salesContext = {
  metrics,
  business: { description: "Interior design services in Bengaluru.", targetAudience: "Homeowners", services: ["Interior Design"] },
  channels: { meta: "not_connected", linkedin: "not_connected", whatsapp: "approved_contact" },
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

test("unsupported Sales claims become optional recommendations during generation and hydration", () => {
  const unsafe = {
    executiveSummary: "Partner with financing companies. Include a 10-year warranty. Offer free site visits. Give a 20% discount. Deliver every project within 30 days. Publish testimonials and case studies. Only 2 slots remain. Launch an Instagram campaign. Publish on LinkedIn.",
    pricingRecommendations: "Charge 10% upfront and guarantee the lowest price.",
    targetCustomerProfile: "Affluent investors and commercial developers.",
  };
  const generated = sanitizeSalesInsights(unsafe, salesContext);
  const hydrated = readStoredSalesInsights(JSON.stringify(unsafe), salesContext);
  assert.deepEqual(hydrated, generated);
  const text = JSON.stringify(generated);
  assert.match(text, /Consider financing partnerships only if/);
  assert.match(text, /Consider a warranty only if/);
  assert.match(text, /Consider offering site visits only if/);
  assert.match(text, /Consider a promotional offer only if/);
  assert.match(text, /Confirm delivery timelines/);
  assert.match(text, /approved testimonials or case studies/);
  assert.match(text, /Use urgency only when/);
  assert.match(text, /connect Meta before publishing/);
  assert.match(text, /connect LinkedIn before publishing/);
  assert.doesNotMatch(text, /10-year|20%|within 30 days|Only 2 slots|Charge 10%|lowest price/i);
  assert.match(generated.targetCustomerProfile, /^Primary B2C customers: Homeowners\./);
});

test("approved saved commercial facts remain available", () => {
  const approved = { ...salesContext, business: { ...salesContext.business, description: "Approved site visits and a five-year warranty are available." } };
  const result = sanitizeSalesInsights({ proposal: "Offer approved site visits. Include the five-year warranty." }, approved);
  assert.match(result.proposal, /approved site visits/);
  assert.match(result.proposal, /five-year warranty/);
});

test("final Sales hydration softens payment, booking, pipeline and upsell policies", () => {
  const saved = {
    pricingRecommendations: "Collect 50% upfront. Charge a paid site visit credited against the final fee.",
    actionPlan: "Open three booking slots. Use a pre-visit checklist. Promise a 2x pipeline lift. Add staging as an upsell service. Pay a 10% referral commission.",
    targetCustomerProfile: "Developers, NRIs and B2B commercial clients are the primary audience.",
    salesChannels: "Use Instagram outreach now. Message prospects on LinkedIn.",
  };
  const result = readStoredSalesInsights(JSON.stringify(saved), salesContext);
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /50% upfront|credited against|three booking slots|pre-visit checklist|2x pipeline|upsell service|10% referral commission/i);
  assert.match(text, /Confirm all percentages, deposits, credits/);
  assert.match(text, /booking process or checklist only after/);
  assert.match(text, /planning goal, not a guaranteed outcome/);
  assert.match(text, /add-on services or referral arrangements only when/);
  assert.match(result.targetCustomerProfile, /^Primary B2C customers: Homeowners\./);
  assert.match(result.targetCustomerProfile, /Potential secondary audience hypothesis/);
  assert.match(text, /connect Meta before publishing/);
  assert.match(text, /connect LinkedIn before publishing/);
});

test("saved Sales output is normalized on authenticated GET without generation", async () => {
  const restored = readStoredSalesInsights(JSON.stringify({ output: { executiveSummary: "Use the 2 verified enquiries. Forecast 100 sales." } }), metrics);
  assert.match(restored.executiveSummary, /^Use the 2 verified enquiries\./);
  assert.match(restored.executiveSummary, /planning hypotheses, not verified outcomes/);
  assert.doesNotMatch(restored.executiveSummary, /100 sales/);
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
