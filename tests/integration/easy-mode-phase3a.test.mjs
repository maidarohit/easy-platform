import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBrandingContext,
  createTrustedModuleExecutionContext,
  getModuleAdapter,
  validateAiManagerOutput,
} from "../../app/lib/easy-mode-execution-contracts.ts";

const textFields = (fields) => Object.fromEntries(fields.map((field) => [field, `${field} customer-safe result`]));

const validOutputs = {
  "ai-manager": textFields(["overview", "branding", "website", "marketing", "seo", "uiux", "sales", "analytics"]),
  branding: textFields(["brandName", "tagline", "story", "mission", "vision", "brandVoice", "colorPalette", "typography", "logoConcept", "marketingSuggestions", "brandStyleGuide"]),
  website: textFields(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"]),
  marketing: textFields(["marketingStrategy", "contentIdeas", "socialMediaStrategy", "adCopy", "contentCalendar", "targetAudienceAnalysis", "emailMarketing", "paidAdsStrategy", "typography", "recommendedTechStack", "seoRecommendations", "funnelSuggestions", "kpis", "growthRecommendations", "marketingScore", "bestChannels", "campaignTimeline", "customerJourney", "contentMix"]),
  seo: textFields(["seoAudit", "keywords", "metaTitles", "metaDescriptions", "internalLinking", "blogTopics", "technicalSEO", "kpis", "growthRecommendations"]),
  uiux: textFields(["accessibility", "designSystem", "desktopExperience", "microInteractions", "mobileExperience", "uiuxStrategy", "userFlow", "userPersonas", "wireframes"]),
  sales: textFields(["executiveSummary", "targetCustomerProfile", "salesFunnel", "leadGenerationStrategy", "salesChannels", "outreachStrategy", "pricingRecommendations", "salesKPIs", "actionPlan", "salesScript", "proposal", "closingStrategy"]),
  analytics: textFields(["executiveSummary", "businessHealthScore", "trafficAnalysis", "leadAnalysis", "salesPerformance", "revenueAnalysis", "marketingPerformance", "conversionAnalysis", "customerInsights", "growthOpportunities", "keyProblems", "aiRecommendations", "actionPlan90Days"]),
  content: { content: "A useful customer-facing article." },
  logo: textFields(["concept", "symbol", "colors", "typography", "meaning"]),
};

for (const [moduleId, output] of Object.entries(validOutputs)) {
  test(`${moduleId} accepts and normalizes its exact valid output`, () => {
    const adapter = getModuleAdapter(moduleId);
    assert.ok(adapter?.validateOutput);
    assert.deepEqual(adapter.validateOutput({ output }), output);
  });

  test(`${moduleId} rejects missing, extra, unsafe, and oversized output`, () => {
    const validator = getModuleAdapter(moduleId)?.validateOutput;
    assert.ok(validator);
    const [first] = Object.keys(output);
    const missing = { ...output };
    delete missing[first];
    assert.equal(validator(missing), null);
    assert.equal(validator({ ...output, script: "alert(1)" }), null);
    assert.equal(validator({ ...output, [first]: "<script>alert(1)</script>" }), null);
    assert.equal(validator({ ...output, [first]: "x".repeat(200_001) }), null);
  });
}

test("unknown modules are rejected and image is explicitly unsupported", () => {
  assert.equal(getModuleAdapter("admin-shell"), null);
  const image = getModuleAdapter("image");
  assert.equal(image?.executionSupport, "unsupported");
  assert.equal(image?.validateOutput, null);
  assert.match(image?.unsupportedReason ?? "", /Durable binary asset storage/);
});

test("trusted context is server-created, validated, frozen, and contains no browser trust path", () => {
  const context = createTrustedModuleExecutionContext({
    userId: "firebase_uid", projectId: "project_123",
    runId: "123e4567-e89b-42d3-a456-426614174000",
    taskId: "123e4567-e89b-42d3-a456-426614174001",
  });
  assert.equal(Object.isFrozen(context), true);
  assert.throws(() => createTrustedModuleExecutionContext({ userId: "../uid", projectId: "project" }));
});

test("branding-context is local, normalized, and prefers validated branding output", () => {
  const branding = validOutputs.branding;
  const result = buildBrandingContext({
    project: { companyName: "Project Name", industry: "Retail", originalBrief: "A local retail business." },
    memory: { businessName: "Memory Name", targetAudience: "Local families" },
    brandingOutput: branding,
  });
  assert.equal(getModuleAdapter("branding-context")?.executionSupport, "local-only");
  assert.equal(getModuleAdapter("branding-context")?.usageCategory, null);
  assert.equal(result?.businessName, branding.brandName);
  assert.equal(result?.industry, "Retail");
});

test("AI Manager eight-section validation remains strict", () => {
  assert.deepEqual(validateAiManagerOutput(validOutputs["ai-manager"]), validOutputs["ai-manager"]);
  assert.equal(validateAiManagerOutput({ ...validOutputs["ai-manager"], ninth: "no" }), null);
});

test("Phase 3A contract has no provider, usage, persistence, or publication execution", async () => {
  const source = await readFile(new URL("../../app/lib/easy-mode-execution-contracts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|startAiUsage|completeAiUsage|failAiUsage|N8N_|projectOutputs|publishedWebsites|website-publications/);
  assert.doesNotMatch(source, /\bexecute\s*:/);
});
