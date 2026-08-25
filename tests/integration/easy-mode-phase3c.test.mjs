import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BrandingExecutionError,
  executeBrandingService,
} from "../../app/lib/branding-execution.ts";
import {
  createTrustedModuleExecutionContext,
  getModuleAdapter,
} from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeNextEasyModeTask } from "../../app/lib/easy-mode-executor.ts";
import {
  EasyModeAttemptError,
} from "../../app/lib/easy-mode-task-attempts.ts";

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
const progress = { runStatus: "In progress", tasks: [{ label: "Brand identity", status: "Waiting" }] };

function claim(moduleId) {
  return {
    context, runId: ids.run, taskId: ids.task, attemptId: ids.attempt,
    attemptNumber: 1, moduleId, executionKey: "execution-key", leaseToken: ids.lease,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
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

test("successful n8n envelope persists, finalizes usage, records execution, and completes", async () => {
  const fixture = dependencies();
  const result = await executeNextEasyModeTask(
    { runId: ids.run, userId: "firebase-user" },
    {
      ...fixture.values,
      executeBranding: (options) => executeBrandingService({
        ...options,
        fetcher: async () => new Response(JSON.stringify([{
          output: productionBrandingOutput,
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
  assert.match(executor, /projectMemory/);
  assert.match(executor, /db\.transaction/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications/);
  assert.match(brandingRoute, /executeBrandingService/);
  assert.match(brandingRoute, /verifyFirebaseIdToken/);
  assert.match(brandingRoute, /startAiUsage/);
  assert.doesNotMatch(page, />Start Building</);
  assert.match(page, /execute-next/);
  assert.match(page, /window\.setInterval/);
  assert.doesNotMatch(page, /while\s*\(/);
  assert.match(manager, /const failedJobs = await db/);
  assert.match(manager, /if \(failedJobs\.length > 0\)/);
});
