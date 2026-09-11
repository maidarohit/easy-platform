import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSpecialistCallbackUrl,
  specialistCallbackBaseUrl,
  validateSpecialistCallbackBody,
} from "../../app/lib/easy-mode-specialist-callbacks.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const successOutput = {
  seoAudit: "Audit",
  keywords: "Keywords",
  metaTitles: "Titles",
  metaDescriptions: "Descriptions",
  internalLinking: "Links",
  blogTopics: "Topics",
  technicalSEO: "Technical",
  kpis: "KPIs",
  growthRecommendations: "Growth",
};

test("specialist callback body validates bounded success and failure contracts", () => {
  assert.deepEqual(validateSpecialistCallbackBody({
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "success",
    providerExecutionId: "exec-1",
    usage: {
      version: 1,
      components: [{ provider: "openai", model: "gpt-5", inputTokens: 10, outputTokens: 12 }],
    },
    result: { output: successOutput },
  }, "33333333-3333-4333-8333-333333333333"), {
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "completed",
    providerExecutionId: "exec-1",
    usageComponents: [{ provider: "openai", model: "gpt-5", inputTokens: 10, outputTokens: 12 }],
    outputPayload: { output: successOutput },
  });

  assert.deepEqual(validateSpecialistCallbackBody({
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "failed",
    error: "Workflow failed safely.",
  }, "33333333-3333-4333-8333-333333333333"), {
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "failed",
    error: "Workflow failed safely.",
  });
});

test("specialist callback rejects malformed or mismatched correlation", () => {
  assert.equal(validateSpecialistCallbackBody({
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "success",
    result: successOutput,
    extra: true,
  }, "33333333-3333-4333-8333-333333333333"), null);
  assert.equal(validateSpecialistCallbackBody({
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "seo-1",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "ai-manager",
    status: "success",
    output: successOutput,
  }, "33333333-3333-4333-8333-333333333333"), null);
  assert.equal(validateSpecialistCallbackBody({
    attemptId: "33333333-3333-4333-8333-333333333333",
    executionKey: "wrong-key",
    runId: "11111111-1111-4111-8111-111111111111",
    taskId: "22222222-2222-4222-8222-222222222222",
    projectId: "project-1",
    module: "seo",
    status: "success",
    output: successOutput,
  }, "44444444-4444-4444-8444-444444444444"), null);
});

test("specialist callback URL is enabled only when the shared callback auth is configured", () => {
  const previousBase = process.env.AI_MANAGER_CALLBACK_BASE_URL;
  const previousSecret = process.env.AI_MANAGER_CALLBACK_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AI_MANAGER_CALLBACK_BASE_URL = "https://example.test";
  delete process.env.AI_MANAGER_CALLBACK_SECRET;
  try {
    assert.equal(specialistCallbackBaseUrl(), null);
    assert.equal(buildSpecialistCallbackUrl("33333333-3333-4333-8333-333333333333"), null);
  } finally {
    if (previousBase === undefined) delete process.env.AI_MANAGER_CALLBACK_BASE_URL;
    else process.env.AI_MANAGER_CALLBACK_BASE_URL = previousBase;
    if (previousSecret === undefined) delete process.env.AI_MANAGER_CALLBACK_SECRET;
    else process.env.AI_MANAGER_CALLBACK_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("specialist callback base URL requires HTTPS in production and only allows local HTTP in non-production", () => {
  const previousBase = process.env.AI_MANAGER_CALLBACK_BASE_URL;
  const previousSecret = process.env.AI_MANAGER_CALLBACK_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AI_MANAGER_CALLBACK_SECRET = "secret";
  try {
    process.env.NODE_ENV = "production";
    process.env.AI_MANAGER_CALLBACK_BASE_URL = "http://example.test";
    assert.equal(specialistCallbackBaseUrl(), null);

    process.env.AI_MANAGER_CALLBACK_BASE_URL = "https://example.test/";
    assert.equal(specialistCallbackBaseUrl(), "https://example.test");

    process.env.NODE_ENV = "development";
    process.env.AI_MANAGER_CALLBACK_BASE_URL = "http://localhost:3000/";
    assert.equal(specialistCallbackBaseUrl(), "http://localhost:3000");

    process.env.AI_MANAGER_CALLBACK_BASE_URL = "http://127.0.0.1:3000/";
    assert.equal(specialistCallbackBaseUrl(), "http://127.0.0.1:3000");

    process.env.AI_MANAGER_CALLBACK_BASE_URL = "http://example.test";
    assert.equal(specialistCallbackBaseUrl(), null);
  } finally {
    if (previousBase === undefined) delete process.env.AI_MANAGER_CALLBACK_BASE_URL;
    else process.env.AI_MANAGER_CALLBACK_BASE_URL = previousBase;
    if (previousSecret === undefined) delete process.env.AI_MANAGER_CALLBACK_SECRET;
    else process.env.AI_MANAGER_CALLBACK_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("shared specialist callback route and sync logic retain auth, idempotency, and late-success recovery guards", async () => {
  const [route, callbackLib] = await Promise.all([
    source("app/api/easy-mode/attempts/[attemptId]/callback/route.ts"),
    source("app/lib/easy-mode-specialist-callbacks.ts"),
  ]);
  assert.match(route, /AI_MANAGER_CALLBACK_SECRET|specialistCallbackSecret/);
  assert.match(route, /readLimitedJson\(request, MAX_CALLBACK_BODY_BYTES\)/);
  assert.match(route, /syncEasyModeSpecialistCallback/);
  assert.match(route, /const continuation = result\.continuation/);
  assert.match(route, /executeEasyModeRun\(continuation\)/);
  assert.match(callbackLib, /attempt\.status === "completed" && task\.status === "completed" && task\.projectOutputId/);
  assert.match(callbackLib, /attempt\.status === "failed_uncertain"/);
  assert.match(callbackLib, /latestAttempt\?\.id === attempt\.id/);
  assert.match(callbackLib, /inArray\(easyModeTaskAttempts\.status, \["dispatching", "running", "failed_uncertain"\]\)/);
  assert.match(callbackLib, /sql`\$\{easyModeTasks\.projectOutputId\} is null`/);
});
