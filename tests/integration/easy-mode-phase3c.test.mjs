import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BrandingExecutionError,
  executeBrandingService,
  validateBrandingWebhookOutput,
} from "../../app/lib/branding-execution.ts";
import {
  createTrustedModuleExecutionContext,
  getModuleAdapter,
} from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeEasyModeRun, executeNextEasyModeTask } from "../../app/lib/easy-mode-executor.ts";
import {
  EasyModeAttemptError,
} from "../../app/lib/easy-mode-task-attempts.ts";
import { sanitizeBrandingOutput } from "../../app/lib/branding-insight-safety.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const ids = {
  run: "11111111-1111-4111-8111-111111111111",
  task: "22222222-2222-4222-8222-222222222222",
  attempt: "33333333-3333-4333-8333-333333333333",
  lease: "44444444-4444-4444-8444-444444444444",
  output: "55555555-5555-4555-8555-555555555555",
  usage: "66666666-6666-4666-8666-666666666666",
};
const context = createTrustedModuleExecutionContext({
  userId: "firebase-user",
  projectId: "project-1",
  runId: ids.run,
  taskId: ids.task,
});
const brandingInput = {
  companyName: "Buzypeezy",
  industry: "Business services",
  targetAudience: "Small business owners",
  brandStyle: "Professional and friendly",
  brandDescription: "Tools that help business owners build their online presence.",
};
const brandingOutput = {
  brandName: "Buzypeezy", tagline: "Build your business with confidence.",
  story: "A practical business building partner.", mission: "Make business growth simpler.",
  vision: "Every owner can build a strong business.", brandVoice: "Clear, warm, and useful.",
  colorPalette: "Blue, violet, and white.", typography: "Modern sans serif.",
  logoConcept: "A simple forward-moving mark.", marketingSuggestions: "Lead with customer outcomes.",
  brandStyleGuide: "Use clear language and consistent colors.",
};
const productionBrandingOutput = Object.fromEntries(
  Object.entries(brandingOutput).filter(([key]) => key !== "brandStyleGuide"),
);
const brandingOutputWithUnsafeMarketingSuggestions = {
  ...productionBrandingOutput,
  marketingSuggestions: "Email hello@example.com or call +91 90000 00000.",
};
const canvasNestBrandingInput = {
  companyName: "CanvasNest",
  industry: "Art marketplace",
  targetAudience: "People looking for meaningful original artwork",
  brandStyle: "Curated, professional, warm and approachable",
  brandDescription: "CanvasNest connects independent artists with people looking for meaningful original artwork.",
};
const canvasNestStructuredPayload = {
  output: {
    brandName: "CanvasNest",
    tagline: "Where Original Art Finds Home",
    story: "CanvasNest connects independent artists with people looking for meaningful original artwork.",
    mission: "Make independent art easier to discover and purchase.",
    vision: "Build a trusted destination for discovering independent artwork.",
    brandVoice: "Curated, professional, warm and approachable.",
    colorPalette: ["#111111", "#F5F1E8", "#A66A4A", "#D4B483"],
    typography: {
      heading: "Playfair Display",
      body: "Inter",
    },
    logoConcept: "A refined canvas-frame inspired wordmark.",
    marketingSuggestions: [
      "Feature independent artist stories.",
      "Create curated artwork collections.",
      "Use educational content to help first-time art buyers.",
    ],
  },
};
const canvasNestNormalizedOutput = {
  brandName: "CanvasNest",
  tagline: "Where Original Art Finds Home",
  story: "CanvasNest connects independent artists with people looking for meaningful original artwork.",
  mission: "Make independent art easier to discover and purchase.",
  vision: "Build a trusted destination for discovering independent artwork.",
  brandVoice: "Curated, professional, warm and approachable.",
  colorPalette: "#111111, #F5F1E8, #A66A4A, #D4B483",
  typography: "Heading: Playfair Display\nBody: Inter",
  logoConcept: "A refined canvas-frame inspired wordmark.",
  marketingSuggestions: [
    "Feature independent artist stories.",
    "Create curated artwork collections.",
    "Use educational content to help first-time art buyers.",
  ].join("\n"),
  brandStyleGuide: [
    "Brand voice: Curated, professional, warm and approachable.",
    "Color palette: #111111, #F5F1E8, #A66A4A, #D4B483",
    "Typography: Heading: Playfair Display\nBody: Inter",
  ].join("\n"),
};
const progress = { runStatus: "In progress", tasks: [{ label: "Brand identity", status: "Waiting" }] };

function claim(moduleId) {
  return {
    context, runId: ids.run, taskId: ids.task, attemptId: ids.attempt,
    attemptNumber: 1, moduleId, executionKey: "execution-key", leaseToken: ids.lease,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

function describeBrandingValidationFailure(payload) {
  const wrapped = payload && typeof payload === "object" && !Array.isArray(payload) && Object.hasOwn(payload, "output")
    ? payload.output
    : payload;
  if (!wrapped || typeof wrapped !== "object" || Array.isArray(wrapped)) {
    return `Branding validation failed: expected an object after wrapper extraction but received ${Array.isArray(wrapped) ? "array" : typeof wrapped}.`;
  }
  const candidate = wrapped;
  const checks = [
    ["brandName", typeof candidate.brandName === "string", typeof candidate.brandName],
    ["tagline", typeof candidate.tagline === "string", typeof candidate.tagline],
    ["story", typeof candidate.story === "string", typeof candidate.story],
    ["mission", typeof candidate.mission === "string", typeof candidate.mission],
    ["vision", typeof candidate.vision === "string", typeof candidate.vision],
    ["brandVoice", typeof candidate.brandVoice === "string", typeof candidate.brandVoice],
    [
      "colorPalette",
      typeof candidate.colorPalette === "string" || (Array.isArray(candidate.colorPalette) && candidate.colorPalette.every((item) => typeof item === "string")),
      Array.isArray(candidate.colorPalette) ? "array" : typeof candidate.colorPalette,
    ],
    [
      "typography",
      typeof candidate.typography === "string" || (
        candidate.typography &&
        typeof candidate.typography === "object" &&
        !Array.isArray(candidate.typography) &&
        typeof candidate.typography.heading === "string" &&
        typeof candidate.typography.body === "string"
      ),
      Array.isArray(candidate.typography) ? "array" : typeof candidate.typography,
    ],
    ["logoConcept", typeof candidate.logoConcept === "string", typeof candidate.logoConcept],
    [
      "marketingSuggestions",
      typeof candidate.marketingSuggestions === "string" || (
        Array.isArray(candidate.marketingSuggestions) &&
        candidate.marketingSuggestions.every((item) => typeof item === "string")
      ),
      Array.isArray(candidate.marketingSuggestions) ? "array" : typeof candidate.marketingSuggestions,
    ],
  ];
  const failed = checks.find(([, ok]) => !ok);
  if (failed) {
    return `Branding validation failed at field ${failed[0]}: received ${failed[2]}.`;
  }
  return "Branding validation failed after field-shape checks passed.";
}

function expectValidBrandingWebhookOutput(input, payload) {
  const validated = validateBrandingWebhookOutput(input, payload);
  assert.ok(validated, describeBrandingValidationFailure(payload));
  return validated;
}

function dependencies(moduleId = "branding") {
  const events = [];
  const calls = {};
  const received = {};
  const count = (name) => { calls[name] = (calls[name] ?? 0) + 1; events.push(name); };
  return {
    calls, events, received,
    values: {
      enabled: () => true,
      claim: async () => { count("claim"); return claim(moduleId); },
      loadBrandingInput: async () => { count("loadBrandingInput"); return brandingInput; },
      executeBranding: async () => { count("provider"); return { output: brandingOutput }; },
      startUsage: async () => { count("startUsage"); return ids.usage; },
      bindUsage: async () => { count("bindUsage"); },
      markDispatching: async () => { count("markDispatching"); },
      markRunning: async (input) => { count("markRunning"); received.markRunning = input; },
      completeAttempt: async () => { count("completeAttempt"); },
      failBeforeDispatch: async () => { count("failBeforeDispatch"); },
      failUncertain: async (input) => { count("failUncertain"); received.failUncertain = input; },
      completeUsage: async () => { count("completeUsage"); },
      failUsage: async () => { count("failUsage"); },
      loadBrandingContext: async () => {
        count("loadBrandingContext");
        return { project: { name: "Buzypeezy", industry: "Business services" } };
      },
      persistBranding: async () => { count("persistBranding"); return { id: ids.output }; },
      persistContext: async () => { count("persistContext"); return { id: ids.output }; },
      progress: async () => progress,
    },
  };
}

test("the server-only feature gate refuses execution without claiming work", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, enabled: () => false },
  );
  assert.equal(result.state, "disabled");
  assert.equal(fixture.calls.claim, undefined);
});

test("branding-context is local, uncharged, persisted before completion, and provider-free", async () => {
  const fixture = dependencies("branding-context");
  const result = await executeNextEasyModeTask({ runId: ids.run, userId: "firebase-user" }, fixture.values);
  assert.equal(result.state, "completed");
  assert.equal(fixture.calls.persistContext, 1);
  assert.equal(fixture.calls.completeAttempt, 1);
  assert.equal(fixture.calls.provider, undefined);
  assert.equal(fixture.calls.startUsage, undefined);
  assert.ok(fixture.events.indexOf("persistContext") < fixture.events.indexOf("completeAttempt"));
});

test("branding claims, charges, dispatches, validates/persists, and finalizes exactly once", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask({ runId: ids.run, userId: "firebase-user" }, fixture.values);
  assert.equal(result.state, "completed");
  for (const name of ["claim", "startUsage", "bindUsage", "markDispatching", "provider", "persistBranding", "completeUsage", "completeAttempt"]) {
    assert.equal(fixture.calls[name], 1, name);
  }
  assert.ok(fixture.events.indexOf("persistBranding") < fixture.events.indexOf("completeAttempt"));
  assert.equal(fixture.calls.failUsage, undefined);
});

test("an active claim prevents duplicate provider and usage work", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, claim: async () => null },
  );
  assert.equal(result.state, "in_progress");
  assert.equal(fixture.calls.provider, undefined);
  assert.equal(fixture.calls.startUsage, undefined);
});

test("unsupported next modules remain unavailable and are never dispatched", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, claim: async () => { throw new EasyModeAttemptError("MODULE_UNSUPPORTED"); } },
  );
  assert.equal(result.state, "not_available");
  assert.equal(fixture.calls.provider, undefined);
  assert.equal(fixture.calls.startUsage, undefined);
});

test("a failure before dispatch is retry-safe and never reaches the provider", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, loadBrandingInput: async () => { throw new Error("hidden detail"); } },
  );
  assert.equal(result.state, "needs_attention");
  assert.equal(fixture.calls.failBeforeDispatch, 1);
  assert.equal(fixture.calls.provider, undefined);
  assert.equal(fixture.calls.startUsage, undefined);
});

test("an uncertain provider failure is not retried and usage is failed once", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, executeBranding: async () => {
      fixture.calls.provider = (fixture.calls.provider ?? 0) + 1;
      throw new BrandingExecutionError("DELIVERY_UNCERTAIN", "uncertain");
    } },
  );
  assert.equal(result.state, "needs_attention");
  assert.equal(fixture.calls.provider, 1);
  assert.equal(fixture.calls.startUsage, 1);
  assert.equal(fixture.calls.failUsage, 1);
  assert.equal(fixture.calls.failUncertain, 1);
  assert.equal(fixture.calls.completeAttempt, undefined);
});

test("failed persistence never completes the task and is classified uncertain", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, persistBranding: async () => {
      fixture.calls.persistBranding = (fixture.calls.persistBranding ?? 0) + 1;
      throw new Error("hidden database detail");
    } },
  );
  assert.equal(result.state, "needs_attention");
  assert.equal(fixture.calls.provider, 1);
  assert.equal(fixture.calls.persistBranding, 1);
  assert.equal(fixture.calls.failUsage, 1);
  assert.equal(fixture.calls.failUncertain, 1);
  assert.equal(fixture.calls.completeAttempt, undefined);
});

test("persisted output is linked for reconciliation when final task completion becomes uncertain", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    { ...fixture.values, completeAttempt: async () => { throw new Error("temporary completion failure"); } },
  );
  assert.equal(result.state, "needs_attention");
  assert.equal(fixture.calls.provider, 1);
  assert.equal(fixture.calls.persistBranding, 1);
  assert.equal(fixture.calls.completeUsage, 1);
  assert.equal(fixture.calls.failUsage, undefined);
  assert.equal(fixture.received.failUncertain.projectOutputId, ids.output);
});

test("cross-tenant claims are returned only as a safe not-found state", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "different-firebase-user" },
    { ...fixture.values, claim: async () => { throw new EasyModeAttemptError("RUN_NOT_FOUND"); } },
  );
  assert.deepEqual(result, { state: "not_found", message: "Business build not found." });
  assert.equal(fixture.calls.provider, undefined);
  assert.equal(fixture.calls.startUsage, undefined);
});

test("shared branding service uses strict validation and hides provider payloads", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests += 1;
    return new Response(JSON.stringify(brandingOutput), { status: 200 });
  };
  const result = await executeBrandingService({
    context, input: brandingInput, fetcher,
    webhookConfig: { url: "https://example.invalid/branding", headers: { "x-test": "safe" } },
  });
  assert.equal(requests, 1);
  assert.deepEqual(result.output, getModuleAdapter("branding").validateOutput(brandingOutput));

  await assert.rejects(
    executeBrandingService({
      context, input: brandingInput,
      fetcher: async () => new Response(JSON.stringify({ error: "raw provider secret" }), { status: 200 }),
      webhookConfig: { url: "https://example.invalid/branding", headers: {} },
    }),
    (error) => error instanceof BrandingExecutionError && error.code === "OUTPUT_INVALID" && !error.message.includes("secret"),
  );
});

test("shared branding service accepts the successful single-item n8n response", async () => {
  const n8nResponse = [{
    output: productionBrandingOutput,
  }];
  const result = await executeBrandingService({
    context,
    input: brandingInput,
    fetcher: async () => new Response(JSON.stringify(n8nResponse), {
      status: 200,
      headers: { "x-easy-n8n-execution-id": "branding-execution-123" },
    }),
    webhookConfig: { url: "https://example.invalid/branding", headers: {} },
  });
  assert.deepEqual(result.output, getModuleAdapter("branding").validateOutput({
    ...productionBrandingOutput,
    brandStyleGuide: [
      `Brand voice: ${productionBrandingOutput.brandVoice}`,
      `Color palette: ${productionBrandingOutput.colorPalette}`,
      `Typography: ${productionBrandingOutput.typography}`,
    ].join("\n"),
  }));
  assert.equal(result.providerExecutionId, "branding-execution-123");
});

test("shared branding service accepts the CanvasNest structured payload, sanitizes it, and keeps the final contract valid", async () => {
  const result = await executeBrandingService({
    context,
    input: canvasNestBrandingInput,
    fetcher: async () => new Response(JSON.stringify(canvasNestStructuredPayload), {
      status: 200,
      headers: { "x-easy-n8n-execution-id": "branding-execution-444" },
    }),
    webhookConfig: { url: "https://example.invalid/branding", headers: {} },
  });

  const validated = expectValidBrandingWebhookOutput(canvasNestBrandingInput, canvasNestStructuredPayload);
  assert.deepEqual(validated, canvasNestNormalizedOutput);
  assert.deepEqual(result.output, canvasNestNormalizedOutput);
  assert.deepEqual(sanitizeBrandingOutput(result.output, canvasNestBrandingInput), canvasNestNormalizedOutput);
  assert.deepEqual(result.output, getModuleAdapter("branding").validateOutput(result.output));
  assert.equal(result.providerExecutionId, "branding-execution-444");
});

test("shared branding service restores sanitized-empty required fields with deterministic safe fallback copy", async () => {
  const result = await executeBrandingService({
    context,
    input: brandingInput,
    fetcher: async () => new Response(JSON.stringify([{
      output: brandingOutputWithUnsafeMarketingSuggestions,
    }]), {
      status: 200,
      headers: { "x-easy-n8n-execution-id": "branding-execution-123" },
    }),
    webhookConfig: { url: "https://example.invalid/branding", headers: {} },
  });
  assert.equal(
    result.output.marketingSuggestions,
    "Focus marketing on the verified services, customer needs, and practical outcomes Buzypeezy provides for small business owners.",
  );
  assert.deepEqual(result.output, getModuleAdapter("branding").validateOutput(result.output));
});

test("successful n8n envelope persists, finalizes usage, records execution, and completes after required-field fallback repair", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    {
      ...fixture.values,
      executeBranding: (options) => executeBrandingService({
        ...options,
        fetcher: async () => new Response(JSON.stringify([{
          output: brandingOutputWithUnsafeMarketingSuggestions,
        }]), {
          status: 200,
          headers: { "x-easy-n8n-execution-id": "branding-execution-123" },
        }),
        webhookConfig: { url: "https://example.invalid/branding", headers: {} },
      }),
    },
  );
  assert.equal(result.state, "completed");
  assert.equal(fixture.calls.persistBranding, 1);
  assert.equal(fixture.calls.completeUsage, 1);
  assert.equal(fixture.calls.completeAttempt, 1);
  assert.equal(fixture.calls.failUsage, undefined);
  assert.equal(fixture.received.markRunning.providerExecutionId, "branding-execution-123");
  assert.ok(fixture.events.indexOf("persistBranding") < fixture.events.indexOf("completeUsage"));
  assert.ok(fixture.events.indexOf("completeUsage") < fixture.events.indexOf("completeAttempt"));
});

test("CanvasNest Branding completes once on the normal Easy Mode path and the same run advances to Website without regenerating Understanding", async () => {
  const websiteTaskId = "77777777-7777-4777-8777-777777777777";
  const websiteAttemptId = "88888888-8888-4888-8888-888888888888";
  const websiteLeaseToken = "99999999-9999-4999-8999-999999999999";
  const websiteContext = createTrustedModuleExecutionContext({
    userId: "firebase-user",
    projectId: "project-1",
    runId: ids.run,
    taskId: websiteTaskId,
  });
  const claims = [
    claim("branding"),
    {
      context: websiteContext,
      runId: ids.run,
      taskId: websiteTaskId,
      attemptId: websiteAttemptId,
      attemptNumber: 1,
      moduleId: "website",
      executionKey: "website-execution-key",
      leaseToken: websiteLeaseToken,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    },
  ];
  const calls = {
    persistBranding: 0,
    persistText: 0,
    completeAttempt: 0,
    executeBranding: 0,
    executeWebsite: 0,
    aiManagerLoads: 0,
    aiManagerStarts: 0,
  };
  const completedAttempts = [];
  const websiteOutput = {
    websiteOverview: "A curated marketplace for original artwork.",
    websiteGoal: "Help customers discover and buy original art.",
    recommendedPages: "Home, Collections, Artists, About, Contact",
    siteStructure: "Feature art discovery, artist stories, and direct enquiry paths.",
    websiteFeatures: "Curated collections, artist profiles, and artwork education.",
    designRecommendations: "Use warm editorial layouts and clear purchase guidance.",
    colourScheme: "Neutral base with warm accent tones.",
    typography: "Editorial serif headlines with clean sans-serif body copy.",
    recommendedTechStack: "Use a reliable content-managed storefront stack.",
    seoRecommendations: "Publish artist pages and collection landing pages.",
  };
  const progressState = () => ({
    runStatus: claims.length === 0 && calls.executeWebsite === 1 ? "Completed" : "In progress",
    tasks: [],
  });

  const dependencies = {
    enabled: () => true,
    claim: async () => claims.shift() ?? null,
    loadBrandingInput: async () => canvasNestBrandingInput,
    executeBranding: async (options) => {
      calls.executeBranding += 1;
      return executeBrandingService({
        ...options,
        fetcher: async () => new Response(JSON.stringify(canvasNestStructuredPayload), {
          status: 200,
          headers: { "x-easy-n8n-execution-id": "branding-execution-444" },
        }),
        webhookConfig: { url: "https://example.invalid/branding", headers: {} },
      });
    },
    loadLogoInput: async () => assert.fail("logo should not execute"),
    executeLogo: async () => assert.fail("logo should not execute"),
    loadContentInput: async () => assert.fail("content should not execute"),
    executeContent: async () => assert.fail("content should not execute"),
    loadAiManagerInput: async () => { calls.aiManagerLoads += 1; throw new Error("ai-manager should not execute"); },
    startAiManagerJob: async () => { calls.aiManagerStarts += 1; throw new Error("ai-manager should not execute"); },
    loadTextInput: async (_context, module) => {
      if (module !== "website") throw new Error(`unexpected text module ${module}`);
      return {
        companyName: "CanvasNest",
        industry: "Art marketplace",
        targetAudience: "Collectors",
        brandStyle: "Curated",
        brandDescription: "CanvasNest connects independent artists with people looking for meaningful original artwork.",
        primaryLanguage: "English",
      };
    },
    executeText: async (options) => {
      if (options.module !== "website") throw new Error(`unexpected executeText module ${options.module}`);
      calls.executeWebsite += 1;
      return { dispatchMode: "sync", output: websiteOutput };
    },
    startUsage: async () => ids.usage,
    bindUsage: async () => {},
    markDispatching: async () => {},
    markRunning: async () => {},
    completeAttempt: async (input) => {
      calls.completeAttempt += 1;
      completedAttempts.push(input.attemptId);
    },
    failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    prepareRetry: async () => assert.fail("retry should not be needed"),
    reconcileUncertain: async () => assert.fail("reconcile should not be needed"),
    completeUsage: async () => {},
    failUsage: async () => assert.fail("usage should not fail"),
    loadBrandingContext: async () => ({ project: { name: "CanvasNest", industry: "Art marketplace" } }),
    persistBranding: async (_context, output) => {
      calls.persistBranding += 1;
      assert.deepEqual(output, canvasNestNormalizedOutput);
      return { id: ids.output };
    },
    persistLogo: async () => assert.fail("logo should not persist"),
    persistContent: async () => assert.fail("content should not persist"),
    persistText: async (_context, module, output) => {
      calls.persistText += 1;
      assert.equal(module, "website");
      assert.deepEqual(output, websiteOutput);
      return { id: websiteAttemptId };
    },
    persistContext: async () => assert.fail("branding-context should not persist"),
    progress: async () => progressState(),
  };

  const first = await executeEasyModeRun({ runId: ids.run, userId: "firebase-user" }, dependencies);
  assert.equal(first.state, "in_progress");
  assert.equal(calls.executeBranding, 1);
  assert.equal(calls.persistBranding, 1);
  assert.equal(calls.executeWebsite, 0);
  assert.equal(calls.completeAttempt, 1);
  assert.equal(calls.aiManagerLoads, 0);
  assert.equal(calls.aiManagerStarts, 0);
  assert.deepEqual(completedAttempts, [ids.attempt]);

  const second = await executeEasyModeRun({ runId: ids.run, userId: "firebase-user" }, dependencies);
  assert.equal(second.state, "completed");
  assert.equal(calls.executeBranding, 1);
  assert.equal(calls.persistBranding, 1);
  assert.equal(calls.executeWebsite, 1);
  assert.equal(calls.persistText, 1);
  assert.equal(calls.completeAttempt, 2);
  assert.equal(calls.aiManagerLoads, 0);
  assert.equal(calls.aiManagerStarts, 0);
  assert.deepEqual(completedAttempts, [ids.attempt, websiteAttemptId]);
});

test("route, persistence, UI, and AI Manager race contracts remain controlled", async () => {
  const [route, executor, attempts, brandingRoute, page, manager] = await Promise.all([
    source("app/api/easy-mode/runs/[runId]/execute-next/route.ts"),
    source("app/lib/easy-mode-executor.ts"),
    source("app/lib/easy-mode-task-attempts.ts"),
    source("app/api/branding-ai/route.ts"),
    source("app/easy-mode/page.tsx"),
    source("app/api/ai-manager/route.ts"),
  ]);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /isEasyModeExecutionEnabled/);
  assert.match(route, /isEmptyObject/);
  assert.doesNotMatch(route, /moduleId|publish|for\s*\(|while\s*\(/);
  assert.match(executor, /allowedModuleIds: ENABLED_MODULES/);
  assert.match(attempts, /resolveEasyModePlan\(run\.goalId\)/);
  assert.match(attempts, /allowedModuleIds\.includes/);
  assert.match(executor, /projectOutputs/);
  assert.match(executor, /persistBrandingOutputAndMemory/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications/);
  assert.match(brandingRoute, /executeBrandingService/);
  assert.match(brandingRoute, /verifyFirebaseIdToken/);
  assert.match(brandingRoute, /claimIdempotentAiUsage/);
  assert.match(brandingRoute, /persistCompletedBrandingGeneration/);
  assert.doesNotMatch(page, />Start Building</);
  assert.match(page, /execute-next/);
  assert.match(page, /window\.setInterval/);
  assert.doesNotMatch(page, /while\s*\(/);
  assert.match(manager, /const failedJobs = await db/);
  assert.match(manager, /if \(failedJobs\.length > 0\)/);
});
