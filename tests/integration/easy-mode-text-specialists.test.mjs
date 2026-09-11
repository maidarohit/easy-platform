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
const canonicalSales = Object.fromEntries(fields.sales.map((field) => [field, `sales ${field} result`]));

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
    const input = specialistModule === "sales"
        ? salesInput
        : specialistModule === "analytics"
          ? analyticsInput
          : brandInput;
    const result = await executeTextSpecialistService({
      module: specialistModule, context, input,
      fetcher: async () => new Response(JSON.stringify([{ output }]), { status: 200 }),
      webhookConfig: { url: `https://example.invalid/${specialistModule}`, headers: {} },
    });
    assert.deepEqual(result.output, getModuleAdapter(specialistModule).validateOutput(output), specialistModule);
  }
});

test("text specialists accept only the strict async acknowledgement contract", async () => {
  const context = createTrustedModuleExecutionContext({
    userId: "firebase-user",
    projectId: "project-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
  });
  const result = await executeTextSpecialistService({
    module: "marketing",
    context,
    input: brandInput,
    asyncDispatch: {
      runId: "11111111-1111-4111-8111-111111111111",
      taskId: "22222222-2222-4222-8222-222222222222",
      attemptId: "33333333-3333-4333-8333-333333333333",
      executionKey: "marketing-1",
      projectId: "project-1",
      module: "marketing",
      callbackUrl: "https://example.test/api/easy-mode/attempts/33333333-3333-4333-8333-333333333333/callback",
      correlationId: "marketing-1",
    },
    fetcher: async () => new Response(JSON.stringify({
      dispatchMode: "async",
      status: "accepted",
      attemptId: "33333333-3333-4333-8333-333333333333",
      executionKey: "marketing-1",
      module: "marketing",
      providerExecutionId: "exec-1",
    }), { status: 202 }),
    webhookConfig: { url: "https://example.invalid/marketing", headers: {} },
  });
  assert.deepEqual(result, {
    dispatchMode: "async",
    module: "marketing",
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "marketing-1",
    callbackStatus: "accepted",
    providerExecutionId: "exec-1",
  });
});

test("malformed async acknowledgements fail closed", async () => {
  const context = createTrustedModuleExecutionContext({
    userId: "firebase-user",
    projectId: "project-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
  });
  await assert.rejects(() => executeTextSpecialistService({
    module: "seo",
    context,
    input: brandInput,
    asyncDispatch: {
      runId: "11111111-1111-4111-8111-111111111111",
      taskId: "22222222-2222-4222-8222-222222222222",
      attemptId: "33333333-3333-4333-8333-333333333333",
      executionKey: "seo-1",
      projectId: "project-1",
      module: "seo",
      callbackUrl: "https://example.test/api/easy-mode/attempts/33333333-3333-4333-8333-333333333333/callback",
      correlationId: "seo-1",
    },
    fetcher: async () => new Response(JSON.stringify({
      dispatchMode: "async",
      status: "accepted",
      attemptId: "33333333-3333-4333-8333-333333333333",
      executionKey: "wrong-execution-key",
      module: "seo",
    }), { status: 202 }),
    webhookConfig: { url: "https://example.invalid/seo", headers: {} },
  }));
});

test("normal Sales execution accepts direct and harmless Respond-to-Webhook envelopes", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const responses = [
    canonicalSales,
    { output: canonicalSales },
    [{ output: canonicalSales }],
    { response: { body: [{ json: { output: canonicalSales } }] } },
  ];
  for (const response of responses) {
    const result = await executeTextSpecialistService({
      module: "sales", context, input: salesInput,
      fetcher: async () => new Response(JSON.stringify(response), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/sales", headers: {} },
    });
    assert.deepEqual(result.output, canonicalSales);
  }
});

test("normal Sales execution rejects an invalid production contract", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(() => executeTextSpecialistService({
    module: "sales", context, input: salesInput,
    fetcher: async () => new Response(JSON.stringify({ output: { executiveSummary: "incomplete" } }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/sales", headers: {} },
  }));
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
  const [executor, adapter, persistence] = await Promise.all([
    source("app/lib/easy-mode-executor.ts"),
    source("app/lib/text-specialist-execution.ts"),
    source("app/lib/easy-mode-specialist-persistence.ts"),
  ]);
  for (const specialistModule of TEXT_SPECIALIST_MODULES) {
    assert.match(executor, new RegExp(`\\b${specialistModule}\\b`));
  }
  assert.match(executor, /startUsage/);
  assert.match(persistence, /insertProjectOutput/);
  assert.match(executor, /projectOutputId: persisted\.id/);
  assert.match(adapter, /N8N_WEBSITE_AI_WEBHOOK_URL/);
  assert.match(adapter, /N8N_ANALYTICS_AI_WEBHOOK_URL/);
  assert.match(executor, /buildSpecialistCallbackUrl/);
  assert.match(adapter, /asyncDispatch/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications|publishedWebsites/);
  assert.doesNotMatch(adapter, /N8N_IMAGE_AI_WEBHOOK_URL/);
});
