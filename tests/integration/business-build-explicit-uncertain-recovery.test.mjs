import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";
import { evaluateFailedTaskRetryEligibility } from "../../app/lib/easy-mode-task-attempts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";
const completedBrandingOutput = {
  brandName: "Example",
  tagline: "Example helps owners move forward with clarity.",
  story: "Example brings a professional brand direction to services, with a clear focus on owners.",
  mission: "Present Example with clear messaging that reflects its services offering and customer focus.",
  vision: "Build a consistent professional brand presence that helps owners understand the value example provides.",
  brandVoice: "Clear, professional, and focused on the verified needs of owners.",
  colorPalette: "Use a simple, accessible color system that supports a professional services brand presentation.",
  typography: "Use readable typography with clear hierarchy for headings, body copy, and calls to action.",
  logoConcept: "Create a simple logo direction for Example that reflects its services focus and professional style.",
  marketingSuggestions: "Focus marketing on the verified services, customer needs, and practical outcomes Example provides for owners.",
  brandStyleGuide: "Use a professional visual direction, clear messaging for owners, and accessible presentation across customer-facing materials.",
};
const completedWebsiteOutput = {
  websiteOverview: "A customer-ready website overview.",
};
const completedMarketingOutput = {
  marketingStrategy: "Use verified business context and customer-safe positioning.",
  contentIdeas: "Share useful guidance tied to verified services.",
  socialMediaStrategy: "Recommend approved channel content without claiming publication.",
  adCopy: "Invite customers to learn more about the verified offer.",
  contentCalendar: "Use an owner-approved content rhythm.",
  targetAudienceAnalysis: "Potential audience segments and suggested motivations (recommendations, not measured facts):\nBusiness owners may respond to practical guidance.",
  emailMarketing: "Use email only when the business owner approves the list and message.",
  paidAdsStrategy: "Treat paid channels as optional until the business owner approves spend.",
  typography: "Use clear, readable typography in customer-facing assets.",
  recommendedTechStack: "Use only approved tools that the business owner chooses to connect.",
  seoRecommendations: "Support search visibility with verified service language.",
  funnelSuggestions: "Use a simple next-step funnel based on verified customer actions.",
  kpis: "Use only the verified business context and connected channels shown above.",
  growthRecommendations: "Keep recommendations tied to verified services and approved channels.",
  marketingScore: "Treat any marketing score as a planning note, not a verified customer metric.",
  bestChannels: "Start with approved channels and expand only after verification.",
  campaignTimeline: "Plan timing only after the business owner approves campaign details.",
  customerJourney: "Guide customers from discovery to an owner-approved next step.",
  contentMix: "Balance educational, proof, and service-focused content using verified inputs.",
};
const completedUiuxOutput = {
  accessibility: "Use accessibility standards as implementation guidance and verify compliance through a formal audit.",
  designSystem: "Verified Branding system — palette: Ivory and charcoal; typography: Elegant serif with clean sans; brand voice: Calm and trustworthy; visual direction: Premium and minimal.",
  desktopExperience: "Use comparison-friendly layouts and visible enquiry actions on larger screens.",
  microInteractions: "Treat conversion and usability improvements as testable objectives, not measured results.",
  mobileExperience: "Prioritize thumb-friendly filters, quick calls, and short enquiry forms.",
  uiuxStrategy: "Guide home buyers and property investors from discovery to a clear next step using verified business context for residential property guidance.",
  userFlow: "Landing page to property categories to listing detail to enquiry form.",
  userPersonas: "Hypothetical / Proposed personas:\nBusy home buyers comparing verified listings and investors evaluating fit.",
  wireframes: "Homepage, listings page, property detail page, enquiry page.",
};
const completedSalesOutput = {
  executiveSummary: "A grounded sales summary.",
  targetCustomerProfile: "Business owners evaluating practical solutions.",
  salesFunnel: "Discovery to proposal to confirmed next step.",
  leadGenerationStrategy: "Use approved channels and verified business context.",
  salesChannels: "Start with owner-approved channels.",
  outreachStrategy: "Use clear follow-up language tied to verified services.",
  pricingRecommendations: "Confirm exact pricing and commercial terms with the business owner.",
  salesKPIs: "Track only verified enquiries, orders, and paid revenue from the connected business context.",
  actionPlan: "Review outcomes weekly and keep recommendations tied to verified business inputs.",
  salesScript: "Open with the customer problem, verified offer, and next step.",
  proposal: "Summarize verified scope, deliverables, and the next decision step.",
  closingStrategy: "Confirm objections, recap verified value, and ask for the next action.",
};
const baseDigit = (taskNumber) => String(taskNumber + 2);

function claimFor(moduleId, taskNumber, attemptNumber = 1) {
  const digit = baseDigit(taskNumber);
  const attemptDigit = String(attemptNumber + 5);
  const taskId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return {
    context: createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId }),
    runId,
    taskId,
    attemptId: `${attemptDigit.repeat(8)}-${attemptDigit.repeat(4)}-4${attemptDigit.repeat(3)}-9${attemptDigit.repeat(3)}-${attemptDigit.repeat(12)}`,
    attemptNumber,
    moduleId,
    executionKey: `${moduleId}-${attemptNumber}`,
    leaseToken: `${attemptDigit.repeat(8)}-${attemptDigit.repeat(4)}-4${attemptDigit.repeat(3)}-a${attemptDigit.repeat(3)}-${attemptDigit.repeat(12)}`,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

function retrySnapshot(overrides = {}) {
  return {
    runStatus: "failed",
    taskId: "22222222-2222-4222-8222-222222222222",
    taskStatus: "failed",
    projectOutputId: null,
    attemptId: "33333333-3333-4333-8333-333333333333",
    attemptTaskId: "22222222-2222-4222-8222-222222222222",
    attemptStatus: "failed_uncertain",
    attemptSafeErrorCode: "TASK_FAILED",
    latestAttemptId: "33333333-3333-4333-8333-333333333333",
    activeAttemptId: null,
    ...overrides,
  };
}

test("Business Build page keeps re-entering the guarded runner until persisted state changes", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /requestInFlight/);
  assert.match(page, /window\.setInterval\(\(\) => void refreshRun\(\), 3_000\)/);
  assert.match(page, /\["queued", "running"\]\.includes\(loaded\.run\.status\)/);
  assert.match(page, /\/api\/easy-mode\/runs\/\$\{encodeURIComponent\(runId\)\}\/execute-next/);
  assert.doesNotMatch(page, /executionStarted/);
  assert.doesNotMatch(page, /\["queued", "running", "partially_completed"\]/);
  assert.match(page, /"Retry failed phase"/);
  assert.doesNotMatch(page, /"Retry final phase"/);
  assert.match(page, /disabled=\{retrying\}/);
});

test("stale Business Build work cannot poll forever without surfacing support state", async () => {
  const page = await source("app/business-build/page.tsx");
  assert.match(page, /setError\("Your completed work is safe, but this build needs support\."\)/);
  assert.match(page, /needsAttention = Boolean\(view && \["failed", "partially_completed"\]\.includes\(view\.run\.status\)\)/);
  assert.match(page, /Your build needs support\./);
});

test("shared retry eligibility allows safe first-phase and later-phase failed retries and blocks unsafe states", () => {
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot()).allowed, true);
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot({
    attemptSafeErrorCode: "DELIVERY_UNCERTAIN",
  })).allowed, true);
  assert.equal(evaluateFailedTaskRetryEligibility(retrySnapshot({
    runStatus: "partially_completed",
    attemptStatus: "failed_before_dispatch",
    attemptSafeErrorCode: "TASK_FAILED",
  })).allowed, true);

  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    activeAttemptId: "44444444-4444-4444-8444-444444444444",
  })), { allowed: false, reason: "active_attempt" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    taskStatus: "completed",
  })), { allowed: false, reason: "task_not_failed" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    projectOutputId: "55555555-5555-4555-8555-555555555555",
  })), { allowed: false, reason: "task_has_output" });
  assert.deepEqual(evaluateFailedTaskRetryEligibility(retrySnapshot({
    latestAttemptId: "66666666-6666-4666-8666-666666666666",
  })), { allowed: false, reason: "attempt_not_latest" });
});

test("uncertain recovery route reconciles first and only then prepares the named failed task", async () => {
  const route = await source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
  const recovery = route.slice(route.indexOf('if (attempt.status === "failed_uncertain")'));
  assert.ok(recovery.indexOf("reconcileUncertainEasyModeAttempt") < recovery.indexOf("prepareUncertainEasyModeTaskRetry"));
  assert.match(route, /ownedTask\.projectOutputId !== null/);
  assert.match(route, /executeEasyModeRun\(\{ runId, userId \}\)/);
});

test("uncertain retry preparation fails closed and preserves completed tasks", async () => {
  const attempts = await source("app/lib/easy-mode-task-attempts.ts");
  const retryPreparation = attempts.slice(attempts.indexOf("async function prepareFailedTaskRetry"));
  assert.match(attempts, /evaluateFailedTaskRetryEligibility/);
  assert.match(attempts, /RETRYABLE_UNCERTAIN_SAFE_ERROR_CODES = new Set\(\["DELIVERY_UNCERTAIN", "TASK_FAILED"\]\)/);
  assert.match(attempts, /inArray\(easyModeRuns\.status, \["failed", "partially_completed"\]\)/);
  assert.match(attempts, /eq\(easyModeTasks\.status, "failed"\)/);
  assert.match(attempts, /ACTIVE_ATTEMPT/);
  assert.match(retryPreparation, /status: "queued"/);
  assert.doesNotMatch(retryPreparation, /status: "completed"|delete\(/);
});

test("customer view and retry backend use the same shared failed-task retry policy", async () => {
  const [customerStatus, route] = await Promise.all([
    source("app/lib/easy-mode-customer-status.ts"),
    source("app/api/easy-mode/runs/[runId]/tasks/[taskId]/retry/route.ts"),
  ]);
  assert.match(customerStatus, /evaluateFailedTaskRetryEligibility/);
  assert.match(customerStatus, /const canRetry = eligibility\.allowed/);
  assert.doesNotMatch(customerStatus, /allowUncertainRecovery === false/);
  assert.match(route, /ACTIVE_ATTEMPT/);
  assert.match(route, /This failed step cannot be retried yet\./);
  assert.match(route, /This step is already being handled\./);
});

test("duplicate execution claims do not produce two provider calls", async () => {
  let claims = 0;
  let providers = 0;
  const claim = {
    context: { userId: "firebase-user", projectId: "project-1", runId, taskId: "22222222-2222-4222-8222-222222222222" },
    runId, taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333", attemptNumber: 2,
    moduleId: "sales", executionKey: "sales-retry",
    leaseToken: "44444444-4444-4444-8444-444444444444", leaseExpiresAt: new Date(Date.now() + 60_000),
  };
  const dependencies = {
    enabled: () => true,
    claim: async () => (++claims === 1 ? claim : null),
    loadTextInput: async () => ({}), startUsage: async () => "usage-1", bindUsage: async () => {},
    markDispatching: async () => {}, executeText: async () => { providers += 1; return { output: {} }; },
    markRunning: async () => {}, persistText: async () => ({ id: "sales-output" }),
    completeUsage: async () => {}, completeAttempt: async () => {},
    failBeforeDispatch: async () => assert.fail("unexpected failure"),
    failUncertain: async () => assert.fail("unexpected failure"), failUsage: async () => {},
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  };
  await Promise.all([
    executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies),
    executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies),
  ]);
  assert.equal(providers, 1);
});

test("first-phase retryable failure re-queues phase 1 and leaves later phases untouched until the next request", async () => {
  const aiManagerTask = claimFor("ai-manager", 0, 1);
  const retriedAiManagerTask = claimFor("ai-manager", 0, 2);
  const untouchedBrandingTask = claimFor("branding", 1, 1);
  const claims = [aiManagerTask, retriedAiManagerTask, untouchedBrandingTask];
  const retriedAttempts = [];
  let aiManagerLoads = 0;
  let jobsStarted = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadAiManagerInput: async () => {
      aiManagerLoads += 1;
      if (aiManagerLoads === 1) throw new Error("temporary phase-1 failure");
      return {
        companyName: "Example",
        businessDescription: "Helpful services.",
        industry: "Services",
        businessGoal: "Grow",
      };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: aiManagerTask.taskId, retryReady: true };
    },
    startUsage: async () => "55555555-5555-4555-8555-555555555555",
    bindUsage: async () => {},
    markDispatching: async () => {},
    startAiManagerJob: async () => {
      jobsStarted += 1;
      return { jobId: "66666666-6666-4666-8666-666666666666" };
    },
    markRunning: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("usage should not start before the retry-safe failure"),
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.equal(aiManagerLoads, 1);
  assert.equal(jobsStarted, 0);
  assert.deepEqual(retriedAttempts, [aiManagerTask.attemptId]);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].moduleId, "ai-manager");

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "in_progress");
  assert.equal(aiManagerLoads, 2);
  assert.equal(jobsStarted, 1);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].moduleId, "branding");
});

test("the same failed 7/7 run retries Branding once, does not regenerate completed Branding, and then advances to Website", async () => {
  const brandingTask = claimFor("branding", 1, 1);
  const retriedBrandingTask = claimFor("branding", 1, 2);
  const websiteTask = claimFor("website", 2, 1);
  const claims = [brandingTask, retriedBrandingTask, websiteTask];
  const claimedModules = [];
  const events = [];
  const retriedAttempts = [];
  let brandingLoads = 0;
  let brandingExecutions = 0;
  let websiteExecutions = 0;
  let websiteCompleted = false;
  const dependencies = {
    enabled: () => true,
    claim: async () => {
      const claim = claims.shift() ?? null;
      if (claim) claimedModules.push(claim.moduleId);
      return claim;
    },
    loadBrandingInput: async () => {
      brandingLoads += 1;
      if (brandingLoads === 1) throw new Error("temporary branding failure");
      events.push("branding-load");
      return {
        companyName: "Example",
        industry: "Services",
        targetAudience: "Owners",
        brandStyle: "Professional",
        brandDescription: "Helpful services.",
      };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: brandingTask.taskId, retryReady: true };
    },
    startUsage: async ({ module }) => `${module === "branding" ? "55555555" : "66666666"}-5555-4555-8555-555555555555`,
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeBranding: async () => {
      brandingExecutions += 1;
      events.push("branding-execute");
      return { output: completedBrandingOutput };
    },
    persistBranding: async () => {
      events.push("branding-persist");
      return { id: "77777777-7777-4777-8777-777777777777" };
    },
    loadTextInput: async (_context, module) => {
      assert.equal(module, "website");
      events.push("website-load");
      return { companyName: "Example" };
    },
    executeText: async ({ module }) => {
      assert.equal(module, "website");
      websiteExecutions += 1;
      events.push("website-execute");
      return { output: completedWebsiteOutput };
    },
    persistText: async (_context, module) => {
      assert.equal(module, "website");
      websiteCompleted = true;
      events.push("website-persist");
      return { id: "88888888-8888-4888-8888-888888888888" };
    },
    markRunning: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage finalization failure"),
    progress: async () => ({ runStatus: websiteCompleted ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(retriedAttempts, [brandingTask.attemptId]);
  assert.equal(brandingLoads, 1);
  assert.equal(claims.length, 2);

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "in_progress");
  assert.equal(brandingLoads, 2);
  assert.equal(claims.length, 1);

  const third = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(third.state, "completed");
  assert.deepEqual(claimedModules, ["branding", "branding", "website"]);
  assert.equal(brandingExecutions, 1);
  assert.equal(websiteExecutions, 1);
  assert.deepEqual(events, [
    "branding-load",
    "branding-execute",
    "branding-persist",
    "website-load",
    "website-execute",
    "website-persist",
  ]);
  assert.equal(claims.length, 0);
});

test("failed UI/UX phase retries once, persists once, and then advances to Sales", async () => {
  const uiuxTask = claimFor("uiux", 5, 1);
  const retriedUiuxTask = claimFor("uiux", 5, 2);
  const salesTask = claimFor("sales", 6, 1);
  const claims = [uiuxTask, retriedUiuxTask, salesTask];
  const claimedModules = [];
  const retriedAttempts = [];
  const events = [];
  let uiuxLoads = 0;
  let uiuxExecutions = 0;
  let uiuxPersists = 0;
  let salesExecutions = 0;
  let salesPersists = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => {
      const claim = claims.shift() ?? null;
      if (claim) claimedModules.push(claim.moduleId);
      return claim;
    },
    loadTextInput: async (_context, module) => {
      if (module === "uiux") {
        uiuxLoads += 1;
        if (uiuxLoads === 1) throw new Error("temporary uiux failure");
        events.push("uiux-load");
      } else {
        assert.equal(module, "sales");
        events.push("sales-load");
      }
      return { companyName: "Example" };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: uiuxTask.taskId, retryReady: true };
    },
    startUsage: async ({ module }) => `${module === "uiux" ? "bbbbbbbb" : "cccccccc"}-5555-4555-8555-555555555555`,
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async ({ module }) => {
      if (module === "uiux") {
        uiuxExecutions += 1;
        events.push("uiux-execute");
        return { output: completedUiuxOutput };
      }
      assert.equal(module, "sales");
      salesExecutions += 1;
      events.push("sales-execute");
      return { output: completedSalesOutput };
    },
    persistText: async (_context, module, value) => {
      if (module === "uiux") {
        assert.deepEqual(value, completedUiuxOutput);
        uiuxPersists += 1;
        events.push("uiux-persist");
        return { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
      }
      assert.equal(module, "sales");
      assert.deepEqual(value, completedSalesOutput);
      salesPersists += 1;
      events.push("sales-persist");
      return { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" };
    },
    markRunning: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage finalization failure"),
    progress: async () => ({ runStatus: salesPersists > 0 ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(retriedAttempts, [uiuxTask.attemptId]);
  assert.equal(uiuxExecutions, 0);
  assert.equal(uiuxPersists, 0);

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "in_progress");
  assert.equal(uiuxExecutions, 1);
  assert.equal(uiuxPersists, 1);
  assert.equal(salesExecutions, 0);

  const third = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(third.state, "completed");
  assert.deepEqual(claimedModules, ["uiux", "uiux", "sales"]);
  assert.equal(uiuxExecutions, 1);
  assert.equal(uiuxPersists, 1);
  assert.equal(salesExecutions, 1);
  assert.equal(salesPersists, 1);
  assert.deepEqual(events, [
    "uiux-load",
    "uiux-execute",
    "uiux-persist",
    "sales-load",
    "sales-execute",
    "sales-persist",
  ]);
  assert.equal(claims.length, 0);
});

test("Sales persists successfully in Easy Mode and already completed Sales is not regenerated", async () => {
  const salesTask = claimFor("sales", 6, 1);
  const retriedSalesTask = claimFor("sales", 6, 2);
  const claims = [salesTask, retriedSalesTask];
  const claimedModules = [];
  const retriedAttempts = [];
  const events = [];
  let salesLoads = 0;
  let salesExecutions = 0;
  let salesPersists = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => {
      const claim = claims.shift() ?? null;
      if (claim) claimedModules.push(claim.moduleId);
      return claim;
    },
    loadTextInput: async (_context, module) => {
      assert.equal(module, "sales");
      salesLoads += 1;
      if (salesLoads === 1) throw new Error("temporary sales failure");
      events.push("sales-load");
      return { companyName: "Example" };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: salesTask.taskId, retryReady: true };
    },
    startUsage: async () => "99999999-9999-4999-8999-999999999999",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async ({ module }) => {
      assert.equal(module, "sales");
      salesExecutions += 1;
      events.push("sales-execute");
      return { output: completedSalesOutput };
    },
    persistText: async (_context, module, value) => {
      assert.equal(module, "sales");
      assert.deepEqual(value, completedSalesOutput);
      salesPersists += 1;
      events.push("sales-persist");
      return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    },
    markRunning: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage finalization failure"),
    progress: async () => ({ runStatus: salesPersists > 0 ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(retriedAttempts, [salesTask.attemptId]);
  assert.equal(salesExecutions, 0);
  assert.equal(salesPersists, 0);

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "completed");
  assert.equal(salesExecutions, 1);
  assert.equal(salesPersists, 1);

  const third = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(third.state, "completed");
  assert.deepEqual(claimedModules, ["sales", "sales"]);
  assert.equal(salesExecutions, 1);
  assert.equal(salesPersists, 1);
  assert.deepEqual(events, ["sales-load", "sales-execute", "sales-persist"]);
  assert.equal(claims.length, 0);
});

test("Marketing persists successfully in Easy Mode and completed Marketing is not regenerated", async () => {
  const marketingTask = claimFor("marketing", 3, 1);
  const retriedMarketingTask = claimFor("marketing", 3, 2);
  const claims = [marketingTask, retriedMarketingTask];
  const claimedModules = [];
  const retriedAttempts = [];
  const events = [];
  let marketingLoads = 0;
  let marketingExecutions = 0;
  let marketingPersists = 0;
  const dependencies = {
    enabled: () => true,
    claim: async () => {
      const claim = claims.shift() ?? null;
      if (claim) claimedModules.push(claim.moduleId);
      return claim;
    },
    loadTextInput: async (_context, module) => {
      assert.equal(module, "marketing");
      marketingLoads += 1;
      if (marketingLoads === 1) throw new Error("temporary marketing failure");
      events.push("marketing-load");
      return { companyName: "Example" };
    },
    prepareRetry: async (input) => {
      retriedAttempts.push(input.attemptId);
      return { taskId: marketingTask.taskId, retryReady: true };
    },
    startUsage: async () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async ({ module }) => {
      assert.equal(module, "marketing");
      marketingExecutions += 1;
      events.push("marketing-execute");
      return { output: completedMarketingOutput };
    },
    persistText: async (_context, module, value) => {
      assert.equal(module, "marketing");
      assert.deepEqual(value, completedMarketingOutput);
      marketingPersists += 1;
      events.push("marketing-persist");
      return { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    },
    markRunning: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    failUsage: async () => assert.fail("unexpected usage finalization failure"),
    progress: async () => ({ runStatus: marketingPersists > 0 ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.deepEqual(retriedAttempts, [marketingTask.attemptId]);
  assert.equal(marketingExecutions, 0);
  assert.equal(marketingPersists, 0);

  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "completed");
  assert.equal(marketingExecutions, 1);
  assert.equal(marketingPersists, 1);

  const third = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(third.state, "completed");
  assert.deepEqual(claimedModules, ["marketing", "marketing"]);
  assert.equal(marketingExecutions, 1);
  assert.equal(marketingPersists, 1);
  assert.deepEqual(events, ["marketing-load", "marketing-execute", "marketing-persist"]);
  assert.equal(claims.length, 0);
});

test("normal queued execution and completed runs remain unchanged", async () => {
  let claims = 0;
  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true, claim: async () => { claims += 1; return null; },
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  });
  assert.equal(result.state, "completed");
  assert.equal(claims, 1);
});
