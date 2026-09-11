import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_PLAN_COST_POLICIES,
  BUSINESS_PLAN_MARKET_LIMITS,
  businessPlanCostPolicy,
  businessPlanUsageLimit,
  missingUsageThresholds,
  summarizeMeasuredCost,
  usageNotificationMessage,
  usagePercentage,
  usageRemaining,
  usageThresholdsReached,
} from "../../app/lib/business-plan-usage.ts";
import { PLAN_LIMITS, categoryForModule } from "../../app/lib/plan-config.ts";
import {
  billingMarketForProviderPlanId,
  resolveSubscriptionBillingDetails,
} from "../../app/lib/subscriptions.ts";

test("Business plan India limits remain the safe default baseline", () => {
  assert.deepEqual(
    {
      projects: PLAN_LIMITS.business.projects,
      websiteGenerations: PLAN_LIMITS.business.websiteGenerations,
      websiteEdits: PLAN_LIMITS.business.websiteEdits,
      brandingGenerations: PLAN_LIMITS.business.brandingGenerations,
      seoGenerations: PLAN_LIMITS.business.seoGenerations,
      marketingGenerations: PLAN_LIMITS.business.marketingGenerations,
      contentGenerations: PLAN_LIMITS.business.contentGenerations,
      salesGenerations: PLAN_LIMITS.business.salesGenerations,
      uiuxGenerations: PLAN_LIMITS.business.uiuxGenerations,
      aiManagerRuns: PLAN_LIMITS.business.aiManagerRuns,
      logoGenerations: PLAN_LIMITS.business.logoGenerations,
      imageGenerations: PLAN_LIMITS.business.imageGenerations,
      presentationGenerations: PLAN_LIMITS.business.presentationGenerations,
      videoGenerations: PLAN_LIMITS.business.videoGenerations,
    },
    {
      projects: 1,
      websiteGenerations: 2,
      websiteEdits: 20,
      brandingGenerations: 5,
      seoGenerations: 10,
      marketingGenerations: 15,
      contentGenerations: 20,
      salesGenerations: 10,
      uiuxGenerations: 5,
      aiManagerRuns: 50,
      logoGenerations: 3,
      imageGenerations: 5,
      presentationGenerations: 2,
      videoGenerations: 1,
    },
  );
});

test("Business plan market variants isolate India and International limits", () => {
  assert.deepEqual(BUSINESS_PLAN_MARKET_LIMITS.india, {
    websiteGenerations: 2,
    websiteEdits: 20,
    brandingGenerations: 5,
    seoGenerations: 10,
    marketingGenerations: 15,
    contentGenerations: 20,
    salesGenerations: 10,
    uiuxGenerations: 5,
    aiManagerRuns: 50,
    logoGenerations: 3,
    imageGenerations: 5,
    presentationGenerations: 2,
    videoGenerations: 1,
    projects: 1,
  });
  assert.deepEqual(BUSINESS_PLAN_MARKET_LIMITS.international, {
    websiteGenerations: 3,
    websiteEdits: 30,
    brandingGenerations: 8,
    seoGenerations: 15,
    marketingGenerations: 20,
    contentGenerations: 30,
    salesGenerations: 15,
    uiuxGenerations: 8,
    aiManagerRuns: 75,
    logoGenerations: 5,
    imageGenerations: 8,
    presentationGenerations: 3,
    videoGenerations: 2,
    projects: 1,
  });
  assert.equal(
    businessPlanUsageLimit({
      plan: "business",
      billingMarket: "india",
      category: "websiteGenerations",
    }),
    2,
  );
  assert.equal(
    businessPlanUsageLimit({
      plan: "business",
      billingMarket: "international",
      category: "websiteGenerations",
    }),
    3,
  );
  assert.equal(
    businessPlanUsageLimit({
      plan: "business",
      billingMarket: null,
      category: "websiteGenerations",
    }),
    2,
  );
});

test("subscription billing details prefer stored market, then provider plan id, then the India-safe legacy fallback", () => {
  const original = { ...process.env };
  try {
    Object.assign(process.env, {
      BILLING_MODE: "test",
      RAZORPAY_KEY_ID: "rzp_test_redacted",
      RAZORPAY_KEY_SECRET: "redacted",
      RAZORPAY_BUSINESS_INR_PLAN_ID: "plan_inr",
      RAZORPAY_BUSINESS_USD_PLAN_ID: "plan_usd",
    });

    assert.equal(billingMarketForProviderPlanId("plan_inr"), "india");
    assert.equal(billingMarketForProviderPlanId("plan_usd"), "international");
    assert.equal(billingMarketForProviderPlanId("plan_unknown"), null);

    assert.deepEqual(
      resolveSubscriptionBillingDetails({
        billingMarket: "international",
        providerPlanId: "plan_inr",
      }),
      {
        market: "international",
        currency: "USD",
        source: "stored_market",
        usedLegacyFallback: false,
      },
    );
    assert.deepEqual(
      resolveSubscriptionBillingDetails({
        billingMarket: null,
        providerPlanId: "plan_usd",
      }),
      {
        market: "international",
        currency: "USD",
        source: "provider_plan_id",
        usedLegacyFallback: false,
      },
    );
    assert.deepEqual(
      resolveSubscriptionBillingDetails({
        billingMarket: null,
        providerPlanId: null,
      }),
      {
        market: "india",
        currency: "INR",
        source: "legacy_india_fallback",
        usedLegacyFallback: true,
      },
    );
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});

test("Marketing and Content modules use dedicated categories instead of the fallback pool", () => {
  assert.equal(categoryForModule("marketing"), "marketingGenerations");
  assert.equal(categoryForModule("content"), "contentGenerations");
  assert.equal(categoryForModule("business-intake"), "standardAiTasks");
});

test("usage counters expose remaining allowance and percentage safely", () => {
  assert.equal(usageRemaining(11, 20), 9);
  assert.equal(usageRemaining(21, 20), 0);
  assert.equal(usagePercentage(1, 2), 50);
  assert.equal(usagePercentage(11, 20), 55);
  assert.equal(usagePercentage(25, 20), 100);
});

test("threshold notifications trigger only at 50, 80, and 100 percent and dedupe cleanly", () => {
  assert.deepEqual(usageThresholdsReached(1, 2), [50]);
  assert.deepEqual(usageThresholdsReached(4, 5), [50, 80]);
  assert.deepEqual(usageThresholdsReached(5, 5), [50, 80, 100]);
  assert.deepEqual(
    missingUsageThresholds({ used: 5, limit: 5, existing: [50, 80] }),
    [100],
  );
  assert.deepEqual(
    missingUsageThresholds({ used: 2, limit: 5, existing: [] }),
    [],
  );
});

test("usage notification copy stays customer-friendly and never exposes cost or tokens", () => {
  const resetAt = new Date("2026-09-30T00:00:00.000Z");
  assert.equal(
    usageNotificationMessage({
      featureLabel: "SEO AI",
      threshold: 50,
      remaining: 5,
      resetAt,
    }),
    "You've used 50% of your monthly SEO AI allowance.",
  );
  assert.match(
    usageNotificationMessage({
      featureLabel: "Marketing AI",
      threshold: 80,
      remaining: 3,
      resetAt,
    }),
    /You've used 80% of your monthly Marketing AI allowance\. 3 remaining until /,
  );
  assert.match(
    usageNotificationMessage({
      featureLabel: "Video AI",
      threshold: 100,
      remaining: 0,
      resetAt,
    }),
    /other Buzypeezy tools remain available/,
  );
});

test("internal cost summary blocks by the correct billing currency threshold and keeps unavailable modules separate", () => {
  const india = summarizeMeasuredCost({
    rows: [
      { module: "assistant", totalCostUsd: 2.5, successfulRuns: 2 },
      { module: "seo", totalCostUsd: 1.5, successfulRuns: 1 },
      { module: "image", totalCostUsd: 0, successfulRuns: 1 },
    ],
    billingMarket: "india",
    exchangeRateInrPerUsd: 100,
  });
  const international = summarizeMeasuredCost({
    rows: [{ module: "assistant", totalCostUsd: 8.8, successfulRuns: 2 }],
    billingMarket: "international",
  });

  assert.equal(india.measuredCostUsd, 4);
  assert.equal(india.measuredCost, 400);
  assert.equal(india.blocked, true);
  assert.deepEqual(india.unavailableModules, ["image"]);
  assert.equal(international.measuredCost, 8.8);
  assert.equal(international.blocked, true);
  assert.deepEqual(BUSINESS_PLAN_COST_POLICIES.india, {
    currency: "INR",
    totalCogsTarget: 500,
    aiWarning: 300,
    aiSafetyCeiling: 350,
  });
  assert.deepEqual(BUSINESS_PLAN_COST_POLICIES.international, {
    currency: "USD",
    totalCogsTarget: 12.5,
    aiWarning: 7.5,
    aiSafetyCeiling: 8.75,
  });
  assert.deepEqual(
    businessPlanCostPolicy("international"),
    BUSINESS_PLAN_COST_POLICIES.international,
  );
});
