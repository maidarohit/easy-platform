import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTrustedModuleExecutionContext } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun } from "../../app/lib/easy-mode-executor.ts";
import { buildAttemptRecoveryState, safeRecoveryPayload } from "../../app/lib/easy-mode-recovery-state.ts";
import {
  replaySavedEasyModeProviderResponse,
  resolveSavedEasyModeProviderResponse,
} from "../../app/lib/easy-mode-provider-recovery.ts";
import { BrandingExecutionError } from "../../app/lib/branding-execution.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const runId = "11111111-1111-4111-8111-111111111111";

const websiteOutput = {
  websiteOverview: "A customer-ready website overview.",
  websiteGoal: "Generate qualified enquiries.",
  recommendedPages: "Home, Services, About, Contact",
  siteStructure: "Homepage, services, about, contact.",
  websiteFeatures: "Contact form and service detail pages.",
  designRecommendations: "Use a clear, trustworthy layout.",
  colourScheme: "Slate and white.",
  typography: "Readable sans-serif.",
  recommendedTechStack: "Use the existing Buzypeezy website stack.",
  seoRecommendations: "Use verified service and location language.",
};

const brandingOutput = {
  brandName: "Example",
  tagline: "Example helps owners move forward with clarity.",
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

function claim(moduleId, attemptNumber = 1) {
  const digit = String(attemptNumber + 2);
  const taskId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return {
    context: createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId }),
    runId,
    taskId,
    attemptId: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-9${digit.repeat(3)}-${digit.repeat(12)}`,
    attemptNumber,
    moduleId,
    executionKey: `${moduleId}-${attemptNumber}`,
    leaseToken: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-a${digit.repeat(3)}-${digit.repeat(12)}`,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

function replayAttempt(moduleId, recoveryState, overrides = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    taskId: "22222222-2222-4222-8222-222222222222",
    runId,
    projectId: "project-1",
    userId: "firebase-user",
    attemptNumber: 1,
    status: "failed_before_dispatch",
    safeErrorCode: "OUTPUT_INVALID",
    usageId: "55555555-5555-4555-8555-555555555555",
    providerExecutionId: null,
    startedAt: new Date("2026-09-14T00:00:00.000Z"),
    finishedAt: new Date("2026-09-14T00:01:00.000Z"),
    recoveryState,
    moduleId,
    taskStatus: "failed",
    taskProjectOutputId: null,
    runStatus: "failed",
    ...overrides,
  };
}

test("Branding saved response replays with zero provider calls", async () => {
  let providerCalls = 0;
  let commitCalls = 0;
  const attempt = replayAttempt("branding", buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "branding",
    rawProviderResponse: { output: brandingOutput },
    normalizedResponse: brandingOutput,
    validationStage: "final_contract",
  }));
  const result = await replaySavedEasyModeProviderResponse(
    { attemptId: attempt.id, userId: "firebase-user" },
    {
      loadAttempt: async () => attempt,
      resolveSavedResponse: async () => ({ ok: true, output: brandingOutput, normalizedResponse: brandingOutput, validationStage: "final_contract" }),
      commitReplay: async () => {
        commitCalls += 1;
        return { state: "completed", projectOutputId: "branding-output", continuation: { runId, userId: "firebase-user" } };
      },
    },
  );
  assert.equal(result.state, "completed");
  assert.equal(providerCalls, 0);
  assert.equal(commitCalls, 1);
});

test("Website saved response replays with zero provider calls", async () => {
  let providerCalls = 0;
  let commitCalls = 0;
  const attempt = replayAttempt("website", buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "website",
    rawProviderResponse: { output: websiteOutput },
    normalizedResponse: websiteOutput,
    validationStage: "final_contract",
  }));
  const result = await replaySavedEasyModeProviderResponse(
    { attemptId: attempt.id, userId: "firebase-user" },
    {
      loadAttempt: async () => attempt,
      resolveSavedResponse: async () => ({ ok: true, output: websiteOutput, normalizedResponse: websiteOutput, validationStage: "final_contract" }),
      commitReplay: async () => {
        commitCalls += 1;
        return { state: "completed", projectOutputId: "website-output", continuation: { runId, userId: "firebase-user" } };
      },
    },
  );
  assert.equal(result.state, "completed");
  assert.equal(providerCalls, 0);
  assert.equal(commitCalls, 1);
});

test("Marketing, SEO, UI/UX, and Sales replay through their shared validators", async () => {
  const recovery = await source("app/lib/easy-mode-provider-recovery.ts");
  assert.match(recovery, /validateMarketingWebhookOutput/);
  assert.match(recovery, /validateSeoWebhookOutput/);
  assert.match(recovery, /validateUiuxWebhookOutput/);
  assert.match(recovery, /validateSalesWebhookOutput/);
});

test("schema failure records the exact validation stage and field when available", async () => {
  const attempt = replayAttempt("website", buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "website",
    rawProviderResponse: { output: { websiteOverview: "Only one field" } },
    validationStage: "final_contract",
    failureCategory: "schema_validation_failure",
  }));
  const result = await resolveSavedEasyModeProviderResponse(attempt);
  assert.deepEqual(result, {
    ok: false,
    failureCategory: "schema_validation_failure",
    validationStage: "initial_contract",
    failedField: "websiteGoal",
    normalizedResponse: null,
  });
});

test("empty_response retries once automatically", async () => {
  const firstAttempt = claim("marketing", 1);
  const secondAttempt = { ...claim("marketing", 2), taskId: firstAttempt.taskId };
  const claims = [firstAttempt, secondAttempt];
  let providerCalls = 0;
  let retries = 0;
  let replayCalls = 0;

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadTextInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async () => {
      providerCalls += 1;
      throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502, { failureCategory: "empty_response", rawProviderResponse: "" });
    },
    saveRecoveryState: async () => {},
    loadRecoveryAttempt: async () => null,
    replaySavedResponse: async () => {
      replayCalls += 1;
      return { state: "failed_closed", canAutoRetry: true, failureCategory: "empty_response", validationStage: "provider_response", failedField: null };
    },
    failUsage: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    prepareRetry: async () => { retries += 1; return { taskId: firstAttempt.taskId, retryReady: true }; },
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  });

  assert.equal(first.state, "in_progress");
  assert.equal(providerCalls, 1);
  assert.equal(replayCalls, 1);
  assert.equal(retries, 1);
});

test("second transient failure stops normally", async () => {
  const firstAttempt = claim("marketing", 1);
  const secondAttempt = { ...claim("marketing", 2), taskId: firstAttempt.taskId };
  const claims = [firstAttempt, secondAttempt];
  let providerCalls = 0;
  let retries = 0;

  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadTextInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async () => {
      providerCalls += 1;
      throw new BrandingExecutionError("OUTPUT_INVALID", "uncertain", 502, { failureCategory: "empty_response", rawProviderResponse: "" });
    },
    saveRecoveryState: async () => {},
    loadRecoveryAttempt: async () => null,
    replaySavedResponse: async () => ({ state: "failed_closed", canAutoRetry: true, failureCategory: "empty_response", validationStage: "provider_response", failedField: null }),
    failUsage: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    prepareRetry: async () => { retries += 1; return { taskId: firstAttempt.taskId, retryReady: true }; },
    progress: async () => ({ runStatus: "Needs attention", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.equal(second.state, "needs_attention");
  assert.equal(providerCalls, 2);
  assert.equal(retries, 1);
});

test("persistence failure never regenerates", async () => {
  const failedBranding = claim("branding", 1);
  let providerCalls = 0;
  let retries = 0;

  const result = await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => failedBranding,
    loadBrandingInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeBranding: async () => {
      providerCalls += 1;
      return { dispatchMode: "sync", output: brandingOutput, providerStatus: 200, rawProviderResponse: JSON.stringify({ output: brandingOutput }), parsedProviderResponse: { output: brandingOutput } };
    },
    saveRecoveryState: async () => {},
    persistBranding: async () => { throw new Error("forced persistence failure"); },
    replaySavedResponse: async () => ({ state: "completed", canAutoRetry: false, failureCategory: null, validationStage: "final_contract", failedField: null, continuation: { runId, userId: "firebase-user" } }),
    loadRecoveryAttempt: async () => null,
    failUsage: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => {},
    prepareRetry: async () => { retries += 1; return { taskId: failedBranding.taskId, retryReady: true }; },
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  });

  assert.equal(result.state, "completed");
  assert.equal(providerCalls, 1);
  assert.equal(retries, 0);
});

test("replay does not consume quota or usage twice", async () => {
  const failedWebsite = claim("website", 1);
  let usageStarts = 0;

  await executeEasyModeRun({ runId, userId: "firebase-user" }, {
    enabled: () => true,
    claim: async () => failedWebsite,
    loadTextInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    startUsage: async () => {
      usageStarts += 1;
      return "usage-1";
    },
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeText: async () => ({ dispatchMode: "sync", output: websiteOutput, providerStatus: 200, rawProviderResponse: JSON.stringify({ output: websiteOutput }), parsedProviderResponse: { output: websiteOutput } }),
    saveRecoveryState: async () => {},
    persistText: async () => { throw new Error("forced persistence failure"); },
    replaySavedResponse: async () => ({ state: "completed", canAutoRetry: false, failureCategory: null, validationStage: "final_contract", failedField: null, continuation: { runId, userId: "firebase-user" } }),
    loadRecoveryAttempt: async () => null,
    failUsage: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => {},
    prepareRetry: async () => assert.fail("replay must not requeue"),
    progress: async () => ({ runStatus: "Completed", tasks: [] }),
  });

  assert.equal(usageStarts, 1);
});

test("replay cannot persist twice", async () => {
  let persisted = 0;
  const state = buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "website",
    rawProviderResponse: { output: websiteOutput },
    normalizedResponse: websiteOutput,
    validationStage: "final_contract",
  });
  const attempt = replayAttempt("website", state);
  const loadAttempt = async () => attempt;
  const commitReplay = async () => {
    persisted += 1;
    attempt.taskStatus = "completed";
    attempt.taskProjectOutputId = "website-output";
    return { state: "completed", projectOutputId: "website-output", continuation: { runId, userId: "firebase-user" } };
  };

  const first = await replaySavedEasyModeProviderResponse({ attemptId: attempt.id, userId: "firebase-user" }, {
    loadAttempt,
    resolveSavedResponse: async () => ({ ok: true, output: websiteOutput, normalizedResponse: websiteOutput, validationStage: "final_contract" }),
    commitReplay,
  });
  const second = await replaySavedEasyModeProviderResponse({ attemptId: attempt.id, userId: "firebase-user" }, {
    loadAttempt,
    resolveSavedResponse: async () => ({ ok: true, output: websiteOutput, normalizedResponse: websiteOutput, validationStage: "final_contract" }),
    commitReplay,
  });

  assert.equal(first.state, "completed");
  assert.equal(second.state, "ignored");
  assert.equal(persisted, 1);
});

test("completed phases are not regenerated after replay", async () => {
  let providerCalls = 0;
  let claims = 0;
  const brandingTask = claim("branding", 1);
  const websiteTask = claim("website", 2);

  const dependencies = {
    enabled: () => true,
    claim: async () => {
      claims += 1;
      return claims === 1 ? brandingTask : claims === 2 ? websiteTask : null;
    },
    loadBrandingInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    loadTextInput: async () => ({ companyName: "Example", industry: "Services", targetAudience: "Owners", brandStyle: "Professional", brandDescription: "Helpful services." }),
    startUsage: async () => "usage-1",
    bindUsage: async () => {},
    markDispatching: async () => {},
    executeBranding: async () => {
      providerCalls += 1;
      return { dispatchMode: "sync", output: brandingOutput, providerStatus: 200, rawProviderResponse: JSON.stringify({ output: brandingOutput }), parsedProviderResponse: { output: brandingOutput } };
    },
    persistBranding: async () => { throw new Error("forced persistence failure"); },
    replaySavedResponse: async () => ({ state: "completed", canAutoRetry: false, failureCategory: null, validationStage: "final_contract", failedField: null, continuation: { runId, userId: "firebase-user" } }),
    executeText: async () => {
      providerCalls += 1;
      return { dispatchMode: "sync", output: websiteOutput, providerStatus: 200, rawProviderResponse: JSON.stringify({ output: websiteOutput }), parsedProviderResponse: { output: websiteOutput } };
    },
    persistText: async () => ({ id: "website-output" }),
    saveRecoveryState: async () => {},
    loadRecoveryAttempt: async () => null,
    failUsage: async () => {},
    failBeforeDispatch: async () => {},
    failUncertain: async () => {},
    completeUsage: async () => {},
    completeAttempt: async () => {},
    prepareRetry: async () => assert.fail("replay should complete the saved phase instead of requeuing it"),
    progress: async () => ({ runStatus: claims > 1 ? "Completed" : "In progress", tasks: [] }),
  };

  const first = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  const second = await executeEasyModeRun({ runId, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.equal(second.state, "completed");
  assert.equal(providerCalls, 2);
});

test("wrong user or project cannot replay another project", async () => {
  const result = await replaySavedEasyModeProviderResponse(
    { attemptId: "33333333-3333-4333-8333-333333333333", userId: "wrong-user" },
    {
      loadAttempt: async () => null,
      resolveSavedResponse: async () => assert.fail("should not resolve another user's attempt"),
      commitReplay: async () => assert.fail("should not commit another user's attempt"),
    },
  );
  assert.equal(result.state, "not_found");
});

test("malformed saved response fails closed", async () => {
  let commitCalls = 0;
  const attempt = replayAttempt("website", buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "website",
    rawProviderResponse: "{\"websiteOverview\":",
    failureCategory: "invalid_json",
    validationStage: "unwrap",
  }));
  const result = await replaySavedEasyModeProviderResponse(
    { attemptId: attempt.id, userId: "firebase-user" },
    {
      loadAttempt: async () => attempt,
      resolveSavedResponse: async (loaded) => resolveSavedEasyModeProviderResponse(loaded),
      saveFailureState: async () => {},
      commitReplay: async () => {
        commitCalls += 1;
        return { state: "completed", projectOutputId: "unexpected", continuation: null };
      },
    },
  );
  assert.equal(result.state, "failed_closed");
  assert.equal(result.validationStage, "unwrap");
  assert.equal(commitCalls, 0);
});

test("recovery payload scrubbing drops stringified secrets before storage", () => {
  const state = buildAttemptRecoveryState({
    projectId: "project-1",
    runId,
    taskId: "22222222-2222-4222-8222-222222222222",
    attemptId: "33333333-3333-4333-8333-333333333333",
    module: "website",
    rawProviderResponse: JSON.stringify({
      Authorization: "Bearer secret-token",
      apiKey: "abc123",
      firebaseToken: "firebase-secret",
      cookie: "session=abc",
      password: "hunter2",
      output: websiteOutput,
    }),
  });
  assert.equal(state.rawProviderResponse, null);
});

test("recovery payload storage is size-bounded", () => {
  const oversized = "x".repeat(256 * 1024 + 1);
  assert.equal(safeRecoveryPayload(oversized), null);
});
