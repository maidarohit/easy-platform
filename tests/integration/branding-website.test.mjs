import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

async function verifyProtectedProxy(post, routePath, environmentVariable) {
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

    assert.equal(response.status, 401);
    assert.equal(captured, undefined, "Unauthenticated requests must not reach n8n");
    const contents = await readFile(new URL(`../../${routePath}`, import.meta.url), "utf8");
    assert.ok(contents.includes(environmentVariable));
    assert.doesNotMatch(contents, /https?:\/\/[^"']*n8n\.cloud/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Branding AI protects its pinned proxy without a live n8n call", () =>
  verifyProtectedProxy(
    brandingPost,
    "app/api/branding-ai/route.ts",
    "N8N_BRANDING_AI_WEBHOOK_URL"
  ));

test("Website AI protects its pinned proxy without a live n8n call", () =>
  verifyProtectedProxy(
    websitePost,
    "app/api/website-ai/route.ts",
    "N8N_WEBSITE_AI_WEBHOOK_URL"
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
