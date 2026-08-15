import assert from "node:assert/strict";
import test from "node:test";

import { POST as brandingPost } from "../../app/api/branding-ai/route.ts";
import { POST as websitePost } from "../../app/api/website-ai/route.ts";
import { getAiModule } from "../../app/lib/ai/registry.ts";
import { parseOrchestrationRequest } from "../../app/lib/ai/orchestrator.ts";

const brandInput = {
  companyName: "Easy Platform",
  industry: "Technology",
  targetAudience: "Small businesses",
  brandStyle: "Minimal",
  brandDescription: "An AI business platform",
};

async function verifyProxy(post, expectedWebhook) {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ output: { name: "result" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await post(
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandInput),
      })
    );

    assert.equal(captured.url, expectedWebhook);
    assert.equal(captured.init.method, "POST");
    assert.deepEqual(JSON.parse(captured.init.body), brandInput);
    assert.deepEqual(await response.json(), { output: { name: "result" } });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Branding AI proxies its pinned contract without a live n8n call", () =>
  verifyProxy(
    brandingPost,
    "https://rohitm2026.app.n8n.cloud/webhook/branding-api"
  ));

test("Website AI proxies its pinned contract without a live n8n call", () =>
  verifyProxy(
    websitePost,
    "https://rohitm2026.app.n8n.cloud/webhook/c5d5e244-e62c-4634-b353-0175b9793c32"
  ));

test("Branding AI and Website AI are registered for orchestration", () => {
  for (const moduleId of ["branding-ai", "website-ai"]) {
    const definition = getAiModule(moduleId);
    assert.equal(definition.integration, "internal-api");
    assert.equal(definition.orchestrationReady, true);
    assert.equal(definition.apiEndpoint, `/api/${moduleId}`);
  }

  const request = parseOrchestrationRequest({
    steps: [
      { id: "brand", moduleId: "branding-ai", input: brandInput },
      { id: "site", moduleId: "website-ai", input: brandInput },
    ],
  });
  assert.deepEqual(
    request.steps.map((step) => step.moduleId),
    ["branding-ai", "website-ai"]
  );
});
