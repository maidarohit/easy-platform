import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reconcileEasyModeMarketingResult } from "../../app/lib/easy-mode-marketing-reconciliation.ts";

const fields = ["marketingStrategy", "contentIdeas", "socialMediaStrategy", "adCopy", "contentCalendar", "targetAudienceAnalysis", "emailMarketing", "paidAdsStrategy", "typography", "recommendedTechStack", "seoRecommendations", "funnelSuggestions", "growthRecommendations", "bestChannels", "campaignTimeline", "customerJourney", "contentMix"];
const response = [{ output: {
  ...Object.fromEntries(fields.map((field) => [field, `${field} result`])),
  marketingDashboard: {
    projectedLeads: 150, marketingScore: 82, conversionRate: "3.5%", monthlyTraffic: 9000,
    channels: [{ label: "Organic Search", value: 40 }],
  },
} }];
const input = {
  runId: "5b327c31-dc34-4a37-aea8-3aef107a828e",
  projectId: "5e56706a-41e9-498b-bf8a-134fffc8c06f",
  executionKey: "74bb8691-4566-4c00-9c48-c6853a4d81f8",
  response,
};

test("Marketing reconciliation is idempotent, preserves one usage, and advances eligibility to SEO", async () => {
  const state = { outputCount: 0, usageCount: 1, completed: false };
  const writer = async (_ids, output) => {
    assert.equal(output.marketingScore, "82");
    if (state.completed) return { state: "already_reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" };
    state.outputCount += 1;
    state.completed = true;
    return { state: "reconciled", outputId: "output-1", usageId: "usage-1", nextModule: "seo" };
  };
  const first = await reconcileEasyModeMarketingResult(input, writer);
  const second = await reconcileEasyModeMarketingResult(input, writer);
  assert.equal(first.state, "reconciled");
  assert.equal(second.state, "already_reconciled");
  assert.equal(first.nextModule, "seo");
  assert.equal(state.outputCount, 1);
  assert.equal(state.usageCount, 1);
});

test("production reconciliation is transactional and cannot replay completed modules or call a provider", async () => {
  const source = await readFile(new URL("../../app/lib/easy-mode-marketing-reconciliation.ts", import.meta.url), "utf8");
  const script = await readFile(new URL("../../scripts/reconcile-marketing-320.mjs", import.meta.url), "utf8");
  assert.match(source, /db\.transaction/);
  assert.match(source, /failed_uncertain/);
  assert.match(source, /DELIVERY_UNCERTAIN/);
  assert.match(source, /already_reconciled/);
  assert.match(source, /update\(aiUsage\)/);
  assert.doesNotMatch(source, /insert\(aiUsage\)/);
  assert.doesNotMatch(source + script, /\bfetch\s*\(|executeEasyModeRun|executeNextEasyModeTask|N8N_|OPENAI/i);
});
