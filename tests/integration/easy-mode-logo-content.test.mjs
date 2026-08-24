import assert from "node:assert/strict";
import test from "node:test";
import { executeContentService } from "../../app/lib/content-execution.ts";
import { createTrustedModuleExecutionContext, getModuleAdapter } from "../../app/lib/easy-mode-execution-contracts.ts";
import { executeNextEasyModeTask } from "../../app/lib/easy-mode-executor.ts";
import { executeLogoService } from "../../app/lib/logo-execution.ts";
import { SpecialistExecutionError } from "../../app/lib/specialist-execution.ts";

const runId = "11111111-1111-4111-8111-111111111111";
const usageIds = [
  "61111111-1111-4111-8111-111111111111",
  "62222222-2222-4222-8222-222222222222",
  "63333333-3333-4333-8333-333333333333",
];
const brandingOutput = {
  brandName: "Example", tagline: "Built for customers", story: "A useful business story.",
  mission: "Serve customers well.", vision: "Grow responsibly.", brandVoice: "Clear and friendly.",
  colorPalette: "Blue and white.", typography: "Modern sans serif.", logoConcept: "A simple rising mark.",
  marketingSuggestions: "Share practical customer stories.", brandStyleGuide: "Use a clear, friendly style.",
};
const logoOutput = {
  concept: "A rising geometric mark.", symbol: "An upward path.", colors: "Blue and white.",
  typography: "Modern sans serif.", meaning: "Progress and trust.",
};
const contentOutput = { content: "Meet Example, a practical partner for growing businesses." };
const brandingInput = {
  companyName: "Example", industry: "Business services", targetAudience: "Business owners",
  brandStyle: "Clear and friendly", brandDescription: "Practical help for growing businesses.",
};
const logoInput = {
  companyName: "Example", industry: "Business services", brandStyle: "Clear and friendly",
  logoIdea: "A simple rising mark.",
};
const contentInput = {
  prompt: "Introduce Example to business owners.", contentType: "Business introduction",
  tone: "Clear and friendly", audience: "Business owners", length: "Medium",
  keywords: "Example, business services",
};

function claim(moduleId, index) {
  const digit = String(index + 2);
  const taskId = `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  return {
    context: createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1", runId, taskId }),
    runId, taskId,
    attemptId: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-9${digit.repeat(3)}-${digit.repeat(12)}`,
    attemptNumber: 1, moduleId, executionKey: `execution-${moduleId}`,
    leaseToken: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-a${digit.repeat(3)}-${digit.repeat(12)}`,
    leaseExpiresAt: new Date(Date.now() + 60_000),
  };
}

test("Build my brand executes Branding then Logo then Content, one task per request", async () => {
  const queuedClaims = [claim("branding", 0), claim("logo", 1), claim("content", 2)];
  const calls = { claim: 0, usage: 0, branding: 0, logo: 0, content: 0, complete: 0 };
  const completed = [];
  const dependencies = {
    enabled: () => true,
    claim: async () => { calls.claim += 1; return queuedClaims.shift() ?? null; },
    loadBrandingInput: async () => brandingInput,
    executeBranding: async () => { calls.branding += 1; return { output: brandingOutput }; },
    loadLogoInput: async () => logoInput,
    executeLogo: async (options) => {
      calls.logo += 1;
      return executeLogoService({
        ...options,
        fetcher: async () => new Response(JSON.stringify([{ output: logoOutput }]), { status: 200 }),
        webhookConfig: { url: "https://example.invalid/logo", headers: {} },
      });
    },
    loadContentInput: async () => contentInput,
    executeContent: async (options) => {
      calls.content += 1;
      return executeContentService({
        ...options,
        fetcher: async () => new Response(JSON.stringify([{ output: contentOutput.content }]), { status: 200 }),
        webhookConfig: { url: "https://example.invalid/content", headers: {} },
      });
    },
    startUsage: async () => usageIds[calls.usage++],
    bindUsage: async () => {},
    markDispatching: async () => {},
    markRunning: async () => {},
    completeAttempt: async (input) => { calls.complete += 1; completed.push(input.projectOutputId); },
    failBeforeDispatch: async () => assert.fail("unexpected pre-dispatch failure"),
    failUncertain: async () => assert.fail("unexpected uncertain failure"),
    completeUsage: async () => {},
    failUsage: async () => assert.fail("unexpected failed usage"),
    persistBranding: async (_context, output) => {
      assert.deepEqual(output, getModuleAdapter("branding").validateOutput(brandingOutput));
      return { id: "71111111-1111-4111-8111-111111111111" };
    },
    persistLogo: async (_context, output) => {
      assert.deepEqual(output, getModuleAdapter("logo").validateOutput(logoOutput));
      return { id: "72222222-2222-4222-8222-222222222222" };
    },
    persistContent: async (_context, output) => {
      assert.deepEqual(output, contentOutput);
      return { id: "73333333-3333-4333-8333-333333333333" };
    },
    progress: async () => ({ runStatus: "In progress", tasks: [] }),
  };

  for (const expectedMessage of ["Brand identity completed.", "Logo completed.", "Content completed."]) {
    const result = await executeNextEasyModeTask({ runId, userId: "firebase-user" }, dependencies);
    assert.equal(result.state, "completed");
    assert.equal(result.message, expectedMessage);
  }
  assert.deepEqual(calls, { claim: 3, usage: 3, branding: 1, logo: 1, content: 1, complete: 3 });
  assert.deepEqual(completed, [
    "71111111-1111-4111-8111-111111111111",
    "72222222-2222-4222-8222-222222222222",
    "73333333-3333-4333-8333-333333333333",
  ]);
});

test("Logo and Content keep strict validation after known envelope normalization", async () => {
  const context = createTrustedModuleExecutionContext({ userId: "firebase-user", projectId: "project-1" });
  await assert.rejects(executeLogoService({
    context, input: logoInput,
    fetcher: async () => new Response(JSON.stringify([{ output: { ...logoOutput, script: "alert(1)" } }]), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/logo", headers: {} },
  }), SpecialistExecutionError);
  await assert.rejects(executeContentService({
    context, input: contentInput,
    fetcher: async () => new Response(JSON.stringify([{ output: "<script>alert(1)</script>" }]), { status: 200 }),
    webhookConfig: { url: "https://example.invalid/content", headers: {} },
  }), SpecialistExecutionError);
});
