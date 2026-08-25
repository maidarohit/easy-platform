import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext, getModuleAdapter } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeTextSpecialistService, TEXT_SPECIALIST_MODULES } from "../../app/lib/text-specialist-execution.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const fields = {
  website: ["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"],
  marketing: ["marketingStrategy", "contentIdeas", "socialMediaStrategy", "adCopy", "contentCalendar", "targetAudienceAnalysis", "emailMarketing", "paidAdsStrategy", "typography", "recommendedTechStack", "seoRecommendations", "funnelSuggestions", "kpis", "growthRecommendations", "marketingScore", "bestChannels", "campaignTimeline", "customerJourney", "contentMix"],
  seo: ["seoAudit", "keywords", "metaTitles", "metaDescriptions", "internalLinking", "blogTopics", "technicalSEO", "kpis", "growthRecommendations"],
  uiux: ["accessibility", "designSystem", "desktopExperience", "microInteractions", "mobileExperience", "uiuxStrategy", "userFlow", "userPersonas", "wireframes"],
  sales: ["executiveSummary", "targetCustomerProfile", "salesFunnel", "leadGenerationStrategy", "salesChannels", "outreachStrategy", "pricingRecommendations", "salesKPIs", "actionPlan", "salesScript", "proposal", "closingStrategy"],
  analytics: ["executiveSummary", "businessHealthScore", "trafficAnalysis", "leadAnalysis", "salesPerformance", "revenueAnalysis", "marketingPerformance", "conversionAnalysis", "customerInsights", "growthOpportunities", "keyProblems", "aiRecommendations", "actionPlan90Days"],
};
const brandInput = { companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Clear", brandDescription: "Helpful services." };
const salesInput = { companyName: "Example", industry: "Services", salesGoal: "Grow sales", targetAudience: "Owners", businessDescription: "Helpful services." };
const analyticsInput = { companyName: "Example", industry: "Services", monthlyVisitors: "Unknown", monthlyLeads: "Unknown", monthlySales: "Unknown", monthlyRevenue: "Unknown", marketingBudget: "Unknown", businessGoal: "Grow", businessDescription: "Helpful services." };

const canonicalMarketing = Object.fromEntries(fields.marketing.map((field) => [field, `marketing ${field} result`]));
const legacyMarketing320 = {
  ...Object.fromEntries(Object.entries(canonicalMarketing).filter(([key]) => !["kpis", "marketingScore"].includes(key))),
  marketingDashboard: {
    projectedLeads: 150,
    marketingScore: 82,
    conversionRate: "3.5%",
    monthlyTraffic: 9000,
    channels: [
      { label: "Organic Search", value: 40 },
      { label: "Paid Search", value: 30 },
      { label: "Social", value: 20 },
      { label: "Email", value: 10 },
    ],
  },
};

test("all six text specialists normalize a single-item n8n envelope through strict validators", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  for (const specialistModule of TEXT_SPECIALIST_MODULES) {
    const output = Object.fromEntries(fields[specialistModule].map((field) => [field, `${specialistModule} ${field} result`]));
    const input = specialistModule === "sales" ? salesInput : specialistModule === "analytics" ? analyticsInput : brandInput;
    const result = await executeTextSpecialistService({
      module: specialistModule, context, input,
      fetcher: async () => new Response(JSON.stringify([{ output }]), { status: 200 }),
      webhookConfig: { url: `https://example.invalid/${specialistModule}`, headers: {} },
    });
    assert.deepEqual(result.output, getModuleAdapter(specialistModule).validateOutput(output), specialistModule);
  }
});

test("canonical Marketing output remains valid and legacy n8n #320 output normalizes to canonical fields", () => {
  const validator = getModuleAdapter("marketing").validateOutput;
  assert.deepEqual(validator(canonicalMarketing), canonicalMarketing);
  const normalized = validator({ output: legacyMarketing320 });
  assert.equal(normalized.marketingScore, "82");
  assert.equal(normalized.kpis, "Projected leads: 150\nConversion rate: 3.5%\nMonthly traffic: 9000\nChannel mix: Organic Search: 40; Paid Search: 30; Social: 20; Email: 10");
  assert.equal(Object.hasOwn(normalized, "marketingDashboard"), false);
  assert.deepEqual(Object.keys(normalized).sort(), [...fields.marketing].sort());
});

test("legacy Marketing normalization rejects missing real metrics and unknown fields", () => {
  const validator = getModuleAdapter("marketing").validateOutput;
  const missingScore = structuredClone(legacyMarketing320);
  delete missingScore.marketingDashboard.marketingScore;
  assert.equal(validator(missingScore), null);
  assert.equal(validator({ ...legacyMarketing320, unexpected: "not allowed" }), null);
});

test("executor enables only approved text specialists and preserves persistence/usage/publication boundaries", async () => {
  const executor = await source("app/lib/easy-mode-executor.ts");
  const adapter = await source("app/lib/text-specialist-execution.ts");
  for (const specialistModule of TEXT_SPECIALIST_MODULES) {
    assert.match(executor, new RegExp(`\\b${specialistModule}\\b`));
  }
  assert.match(executor, /startUsage/);
  assert.match(executor, /insertProjectOutput/);
  assert.match(executor, /projectOutputId: persisted\.id/);
  assert.match(adapter, /N8N_WEBSITE_AI_WEBHOOK_URL/);
  assert.match(adapter, /N8N_ANALYTICS_AI_WEBHOOK_URL/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications|publishedWebsites/);
  assert.doesNotMatch(adapter, /N8N_IMAGE_AI_WEBHOOK_URL/);
});
