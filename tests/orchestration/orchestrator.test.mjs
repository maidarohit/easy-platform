import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidOrchestrationRequestError,
  orchestrateAiModules,
  parseOrchestrationRequest,
} from "../../app/lib/ai/orchestrator.ts";

const jsonResult = (data) => ({
  kind: "json",
  data,
  status: 200,
  contentType: "application/json",
});

test("orchestrates one or multiple selected modules in order", async () => {
  const calls = [];
  const result = await orchestrateAiModules(
    {
      steps: [
        { id: "seo", moduleId: "seo-ai", input: { companyName: "Easy" } },
        { id: "sales", moduleId: "sales-ai", input: { companyName: "Easy" } },
      ],
    },
    {
      invoke: async (moduleId, input) => {
        calls.push({ moduleId, input });
        return jsonResult({ generatedBy: moduleId });
      },
    }
  );

  assert.deepEqual(calls.map((call) => call.moduleId), ["seo-ai", "sales-ai"]);
  assert.equal(result.status, "succeeded");
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].moduleName, "SEO AI");
});

test("passes requested successful output and shared context to a later step", async () => {
  const calls = [];
  await orchestrateAiModules(
    {
      context: { campaign: "launch" },
      steps: [
        { id: "strategy", moduleId: "marketing-ai", input: { companyName: "Easy" } },
        {
          id: "content",
          moduleId: "content-ai",
          input: { prompt: "Write a post" },
          includeOutputsFrom: ["strategy"],
        },
      ],
    },
    {
      invoke: async (moduleId, input) => {
        calls.push({ moduleId, input });
        return jsonResult({ value: moduleId });
      },
    }
  );

  assert.deepEqual(calls[1].input.orchestrationContext, {
    campaign: "launch",
    upstreamOutputs: { strategy: { value: "marketing-ai" } },
  });
});

test("isolates a module failure and returns partial results", async () => {
  const result = await orchestrateAiModules(
    {
      steps: [
        { id: "first", moduleId: "seo-ai", input: {} },
        { id: "second", moduleId: "sales-ai", input: {} },
      ],
    },
    {
      invoke: async (moduleId) => {
        if (moduleId === "seo-ai") throw new Error("SEO unavailable");
        return jsonResult({ ok: true });
      },
    }
  );

  assert.equal(result.status, "partial");
  assert.equal(result.results[0].status, "failed");
  assert.equal(result.results[0].error.message, "SEO unavailable");
  assert.equal(result.results[1].status, "succeeded");
});

test("does not pass output from a failed dependency", async () => {
  let laterInput;
  await orchestrateAiModules(
    {
      steps: [
        { id: "failed", moduleId: "seo-ai", input: {} },
        {
          id: "later",
          moduleId: "content-ai",
          input: {},
          includeOutputsFrom: ["failed"],
        },
      ],
    },
    {
      invoke: async (moduleId, input) => {
        if (moduleId === "seo-ai") throw new Error("failed");
        laterInput = input;
        return jsonResult({ ok: true });
      },
    }
  );

  assert.deepEqual(laterInput.orchestrationContext.upstreamOutputs, {});
});

test("represents binary module responses as JSON-safe output metadata", async () => {
  const result = await orchestrateAiModules(
    { steps: [{ id: "image", moduleId: "image-ai", input: {} }] },
    {
      invoke: async () => ({
        kind: "binary",
        data: new Blob(["image"]),
        status: 200,
        contentType: "image/png",
      }),
    }
  );

  assert.deepEqual(result.results[0].output, {
    kind: "binary",
    contentType: "image/png",
    size: 5,
  });
});

test("rejects recursive AI Manager selection", () => {
  assert.throws(
    () =>
      parseOrchestrationRequest({
        steps: [{ id: "loop", moduleId: "ai-manager", input: {} }],
      }),
    (error) =>
      error instanceof InvalidOrchestrationRequestError &&
      error.message === "AI Manager cannot invoke itself."
  );
});

test("rejects forward references and duplicate step ids", () => {
  assert.throws(() =>
    parseOrchestrationRequest({
      steps: [
        {
          id: "first",
          moduleId: "seo-ai",
          input: {},
          includeOutputsFrom: ["later"],
        },
        { id: "later", moduleId: "sales-ai", input: {} },
      ],
    })
  );

  assert.throws(() =>
    parseOrchestrationRequest({
      steps: [
        { id: "same", moduleId: "seo-ai", input: {} },
        { id: "same", moduleId: "sales-ai", input: {} },
      ],
    })
  );
});
