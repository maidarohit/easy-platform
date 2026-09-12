import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext, getModuleAdapter } from "../../app/lib/easy-mode-execution-contracts.ts";
import { validateMarketingWebhookOutput } from "../../app/lib/marketing-insight-safety.ts";
import { validateSeoWebhookOutput } from "../../app/lib/seo-webhook-validation.ts";
import { validateUiuxWebhookOutput } from "../../app/lib/uiux-insight-safety.ts";
import { validateAnalyticsWebhookOutput } from "../../app/lib/analytics-insight-safety.ts";
import { executeTextSpecialistService, TEXT_SPECIALIST_MODULES } from "../../app/lib/text-specialist-execution.ts";
import { validateBrandingWebhookOutput } from "../../app/lib/branding-execution.ts";

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
const websiteInput = { ...brandInput, primaryLanguage: "English" };
const salesInput = { companyName: "Example", industry: "Services", salesGoal: "Grow sales", targetAudience: "Owners", businessDescription: "Helpful services." };
const analyticsInput = { companyName: "Example", industry: "Services", monthlyVisitors: "Unknown", monthlyLeads: "Unknown", monthlySales: "Unknown", monthlyRevenue: "Unknown", marketingBudget: "Unknown", businessGoal: "Grow", businessDescription: "Helpful services." };
const canonicalBranding = {
  brandName: "Example",
  tagline: "Clear value for owners.",
  story: "A grounded brand story.",
  mission: "A grounded mission.",
  vision: "A grounded vision.",
  brandVoice: "Clear and confident.",
  colorPalette: "Navy and white.",
  typography: "Readable type.",
  logoConcept: "Simple mark.",
  marketingSuggestions: "Use verified value points.",
  brandStyleGuide: "Keep branding consistent.",
};
const canonicalUiux = Object.fromEntries(fields.uiux.map((field) => [field, `uiux ${field} result`]));
const canonicalWebsite = Object.fromEntries(fields.website.map((field) => [field, `website ${field} result`]));
const canonicalAnalytics = Object.fromEntries(fields.analytics.map((field) => [field, `analytics ${field} result`]));
const canonicalSales = Object.fromEntries(fields.sales.map((field) => [field, `sales ${field} result`]));
const marketingValidationContext = {
  website: { published: true, url: "https://example.test" },
  business: {
    name: "Example",
    industry: "Services",
    location: "Bengaluru",
    services: ["Helpful services"],
    description: "Helpful services.",
    targetAudience: "Owners",
    brandStyle: "Clear",
  },
  channels: { meta: "not_connected", linkedin: "connected", whatsapp: "not_connected" },
  savedEnquiries: 2,
  unavailableMetrics: ["website visitors", "CTR", "campaign ROI", "CAC"],
};
const uiuxValidationContext = {
  website: { published: true, url: "https://example.test" },
  business: {
    name: "Example",
    industry: "Services",
    location: "Bengaluru",
    services: ["Helpful services"],
    description: "Helpful services.",
    targetAudience: "Owners",
    brandStyle: "Clear",
  },
  branding: {
    palette: "Navy #001122",
    typography: "Inter",
    voice: "Clear and confident",
    direction: "Modern and clear",
  },
};
const salesValidationContext = {
  project: { id: "project-1", goal: "Grow sales" },
  website: { published: true, publishedUrl: "https://example.test" },
  business: {
    name: "Example",
    industry: "Services",
    description: "Helpful services.",
    location: "Bengaluru",
    targetAudience: "Owners",
    services: ["Helpful services"],
  },
  channels: { meta: "not_connected", linkedin: "not_connected", whatsapp: "approved_contact" },
  metrics: {
    published: true,
    publishedUrl: "https://example.test",
    visitors: null,
    visitorsStatus: "not_measured",
    enquiries: 2,
    orders: 3,
    paidOrders: 1,
    fulfilledOrders: 1,
    paidRevenuePaise: 199900,
    currency: "INR",
    enquiryToPaidOrderRate: 50,
  },
};

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
        : specialistModule === "website"
          ? websiteInput
        : specialistModule === "analytics"
          ? analyticsInput
          : brandInput;
    const result = await executeTextSpecialistService({
      module: specialistModule, context, input,
      ...(specialistModule === "marketing" ? { marketingValidationContext } : {}),
      ...(specialistModule === "seo" ? { seoValidationContext: marketingValidationContext } : {}),
      ...(specialistModule === "uiux" ? { uiuxValidationContext } : {}),
      ...(specialistModule === "sales" ? { salesValidationContext } : {}),
      fetcher: async () => new Response(JSON.stringify([{ output }]), { status: 200 }),
      webhookConfig: { url: `https://example.invalid/${specialistModule}`, headers: {} },
    });
    const expected = specialistModule === "marketing"
      ? validateMarketingWebhookOutput({ output }, marketingValidationContext)
      : specialistModule === "seo"
        ? validateSeoWebhookOutput({ output }, marketingValidationContext)
        : specialistModule === "uiux"
          ? validateUiuxWebhookOutput({ output }, uiuxValidationContext)
          : specialistModule === "analytics"
            ? validateAnalyticsWebhookOutput({ output })
      : getModuleAdapter(specialistModule).validateOutput(output);
    assert.deepEqual(result.output, expected, specialistModule);
  }
});

test("normal UI/UX execution accepts direct, output-wrapped, result-string, and text-string payloads", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const responses = [
    ["direct", canonicalUiux],
    ["output", { output: canonicalUiux }],
    ["result-string", { result: JSON.stringify(canonicalUiux) }],
    ["text-string", { text: JSON.stringify(canonicalUiux) }],
  ];
  for (const [label, response] of responses) {
    const result = await executeTextSpecialistService({
      module: "uiux",
      context,
      input: brandInput,
      uiuxValidationContext,
      fetcher: async () => new Response(JSON.stringify(response), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/uiux", headers: {} },
    });
    assert.deepEqual(result.output, validateUiuxWebhookOutput(response, uiuxValidationContext), label);
  }
});

test("Branding shared validation accepts stringified result and text payloads", () => {
  assert.deepEqual(
    validateBrandingWebhookOutput(brandInput, { result: JSON.stringify(canonicalBranding) }),
    canonicalBranding,
  );
  assert.deepEqual(
    validateBrandingWebhookOutput(brandInput, { text: JSON.stringify(canonicalBranding) }),
    canonicalBranding,
  );
});

test("Website execution accepts stringified result and text payloads without weakening the contract", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  for (const response of [{ result: JSON.stringify(canonicalWebsite) }, { text: JSON.stringify(canonicalWebsite) }]) {
    const result = await executeTextSpecialistService({
      module: "website",
      context,
      input: websiteInput,
      fetcher: async () => new Response(JSON.stringify(response), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/website", headers: {} },
    });
    assert.deepEqual(result.output, canonicalWebsite);
  }
  await assert.rejects(() => executeTextSpecialistService({
    module: "website",
    context,
    input: websiteInput,
    fetcher: async () => new Response(JSON.stringify({ result: JSON.stringify({ ...canonicalWebsite, unexpected: "no" }) }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/website", headers: {} },
  }));
});

test("SEO execution normalizes standalone-style payloads and strips unsupported metrics", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const standaloneSeo = {
    keywordResearch: "Guaranteed rankings. Useful customer questions.",
    metaTitles: "Helpful title ideas.",
    metaDescriptions: "Create concise descriptions for verified services.",
    internalLinking: "Link service pages to contact pages.",
    blogTopics: "Write answers to common customer questions.",
    technicalSEO: "Do not use keyword density. Improve crawlable headings.",
    seoStrategy: "Grow traffic 40% with search volume wins. Focus on verified service pages.",
    growthRecommendations: "Increase traffic 25%. Improve local visibility with verified service language.",
  };
  const result = await executeTextSpecialistService({
    module: "seo",
    context,
    input: brandInput,
    seoValidationContext: marketingValidationContext,
    fetcher: async () => new Response(JSON.stringify({ output: standaloneSeo }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/seo", headers: {} },
  });
  assert.deepEqual(Object.keys(result.output).sort(), [...fields.seo].sort());
  assert.match(result.output.keywords, /Useful customer questions/);
  assert.doesNotMatch(JSON.stringify(result.output), /Guaranteed rankings|search volume|keyword density|40%|25%/i);
});

test("Analytics execution applies the same safety sanitization as standalone", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const payload = {
    ...canonicalAnalytics,
    trafficAnalysis: "Traffic will grow 40%. Visitor data is unavailable.",
  };
  const result = await executeTextSpecialistService({
    module: "analytics",
    context,
    input: analyticsInput,
    fetcher: async () => new Response(JSON.stringify({ result: JSON.stringify(payload) }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/analytics", headers: {} },
  });
  assert.equal(result.output.trafficAnalysis, "Visitor data is unavailable.");
});

test("new shared UI/UX, SEO, and Analytics validators still fail closed on malformed JSON or invalid schemas", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(() => executeTextSpecialistService({
    module: "uiux",
    context,
    input: brandInput,
    uiuxValidationContext,
    fetcher: async () => new Response(JSON.stringify({ result: "{\"accessibility\":" }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/uiux", headers: {} },
  }));
  await assert.rejects(() => executeTextSpecialistService({
    module: "seo",
    context,
    input: brandInput,
    seoValidationContext: marketingValidationContext,
    fetcher: async () => new Response(JSON.stringify({ output: { seoStrategy: "Only one field" } }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/seo", headers: {} },
  }));
  await assert.rejects(() => executeTextSpecialistService({
    module: "analytics",
    context,
    input: analyticsInput,
    fetcher: async () => new Response(JSON.stringify({ output: { executiveSummary: "Only one field" } }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/analytics", headers: {} },
  }));
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
    marketingValidationContext,
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

test("normal Sales execution accepts direct, output-wrapped, result-string, and text-string payloads", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const responses = [
    ["direct", canonicalSales],
    ["output", { output: canonicalSales }],
    ["result-string", { result: JSON.stringify(canonicalSales) }],
    ["text-string", { text: JSON.stringify(canonicalSales) }],
  ];
  for (const [label, response] of responses) {
    const result = await executeTextSpecialistService({
      module: "sales", context, input: salesInput,
      salesValidationContext,
      fetcher: async () => new Response(JSON.stringify(response), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/sales", headers: {} },
    });
    assert.deepEqual(result.output, canonicalSales, label);
  }
});

test("normal Sales execution still accepts harmless nested webhook wrappers", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const result = await executeTextSpecialistService({
    module: "sales", context, input: salesInput,
    salesValidationContext,
    fetcher: async () => new Response(JSON.stringify({ response: { body: [{ json: { output: canonicalSales } }] } }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/sales", headers: {} },
  });
  assert.deepEqual(result.output, canonicalSales);
});

test("malformed Sales JSON still fails safely", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(() => executeTextSpecialistService({
    module: "sales", context, input: salesInput,
    salesValidationContext,
    fetcher: async () => new Response(JSON.stringify({ result: "{\"executiveSummary\":" }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/sales", headers: {} },
  }));
});

test("normal Sales execution rejects an invalid production contract", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(() => executeTextSpecialistService({
    module: "sales", context, input: salesInput,
    salesValidationContext,
    fetcher: async () => new Response(JSON.stringify({ output: { executiveSummary: "incomplete" } }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/sales", headers: {} },
  }));
});

test("normal Marketing execution accepts canonical-only, legacy-only dashboard, and hybrid dashboard payloads", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const safeCanonicalMarketing = {
    ...canonicalMarketing,
    targetAudienceAnalysis: "Business owners may respond to practical positioning.",
    kpis: "Use approved channels and customer-safe messaging.",
    marketingScore: "80",
  };
  const hybridMarketing = {
    ...safeCanonicalMarketing,
    marketingDashboard: structuredClone(legacyMarketing320.marketingDashboard),
  };
  const responses = [
    ["canonical-only", safeCanonicalMarketing],
    ["legacy-only", legacyMarketing320],
    ["hybrid", hybridMarketing],
  ];
  for (const [label, response] of responses) {
    const result = await executeTextSpecialistService({
      module: "marketing",
      context,
      input: brandInput,
      marketingValidationContext,
      fetcher: async () => new Response(JSON.stringify({ output: response }), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/marketing", headers: {} },
    });
    assert.equal(typeof result.output.marketingStrategy, "string", label);
    assert.equal(Object.hasOwn(result.output, "marketingDashboard"), false, label);
    assert.equal(result.output.marketingScore, "Treat any marketing score as a planning note, not a verified customer metric.", label);
  }
});

test("hybrid and legacy Marketing payloads do not persist projected dashboard metrics as customer facts", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  const result = await executeTextSpecialistService({
    module: "marketing",
    context,
    input: brandInput,
    marketingValidationContext,
    fetcher: async () => new Response(JSON.stringify({ output: legacyMarketing320 }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/marketing", headers: {} },
  });
  assert.equal(result.output.kpis, "Use only the verified business context and connected channels shown above.");
  assert.doesNotMatch(JSON.stringify(result.output), /Projected leads|Conversion rate|Monthly traffic|Channel mix|3\.5%|9000|82/);
});

test("malformed Marketing payload still fails safely", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(() => executeTextSpecialistService({
    module: "marketing",
    context,
    input: brandInput,
    marketingValidationContext,
    fetcher: async () => new Response(JSON.stringify({ result: "{\"marketingStrategy\":" }), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/marketing", headers: {} },
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
  const [executor, adapter, persistence, callbacks, salesSafety, marketingSafety] = await Promise.all([
    source("app/lib/easy-mode-executor.ts"),
    source("app/lib/text-specialist-execution.ts"),
    source("app/lib/easy-mode-specialist-persistence.ts"),
    source("app/lib/easy-mode-specialist-callbacks.ts"),
    source("app/lib/sales-insight-safety.ts"),
    source("app/lib/marketing-insight-safety.ts"),
  ]);
  for (const specialistModule of TEXT_SPECIALIST_MODULES) {
    assert.match(executor, new RegExp(`\\b${specialistModule}\\b`));
  }
  assert.match(executor, /startUsage/);
  assert.match(persistence, /insertProjectOutput/);
  assert.match(executor, /projectOutputId: persisted\.id/);
  assert.match(adapter, /N8N_WEBSITE_AI_WEBHOOK_URL/);
  assert.match(adapter, /N8N_ANALYTICS_AI_WEBHOOK_URL/);
  assert.match(adapter, /validateMarketingWebhookOutput/);
  assert.match(adapter, /validateSalesWebhookOutput/);
  assert.match(adapter, /validateSeoWebhookOutput/);
  assert.match(adapter, /validateUiuxWebhookOutput/);
  assert.match(adapter, /validateAnalyticsWebhookOutput/);
  assert.match(executor, /buildSpecialistCallbackUrl/);
  assert.match(adapter, /asyncDispatch/);
  assert.match(callbacks, /validateMarketingWebhookOutput/);
  assert.match(callbacks, /validateSalesWebhookOutput/);
  assert.match(callbacks, /validateSeoWebhookOutput/);
  assert.match(callbacks, /validateUiuxWebhookOutput/);
  assert.match(callbacks, /validateAnalyticsWebhookOutput/);
  assert.match(marketingSafety, /validateMarketingWebhookOutput/);
  assert.match(salesSafety, /validateSalesWebhookOutput/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications|publishedWebsites/);
  assert.doesNotMatch(adapter, /N8N_IMAGE_AI_WEBHOOK_URL/);
});
