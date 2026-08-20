import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { AI_MODULES } from "../../app/lib/ai/registry.ts";

const frontendFiles = {
  "analytics-ai": "app/analytics-ai/page.tsx",
  "branding-ai": "app/branding-ai/page.tsx",
  "website-ai": "app/dashboard/website-ai/page.tsx",
  "marketing-ai": "app/marketing-ai/page.tsx",
  "sales-ai": "app/sales-ai/page.tsx",
  "seo-ai": "app/seo-ai/page.tsx",
  "uiux-ai": "app/uiux-ai/page.tsx",
  "content-ai": "app/dashboard/content-ai/page.tsx",
  "logo-ai": "app/dashboard/logo-ai/page.tsx",
  "image-ai": "app/dashboard/image-ai/page.tsx",
  "presentation-ai": "app/dashboard/presentation-ai/page.tsx",
  "video-ai": "app/dashboard/video-ai/page.tsx",
  "automation-content": "app/dashboard/automation/page.tsx",
  "automation-email": "app/dashboard/automation/page.tsx",
  "automation-social": "app/dashboard/automation/page.tsx",
  "automation-workflow": "app/dashboard/automation/page.tsx",
  "automation-pipeline": "app/dashboard/automation/page.tsx",
};

const rootUrl = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("every orchestratable module uses an existing internal API route", async () => {
  const orchestratable = AI_MODULES.filter(
    (definition) => definition.orchestrationReady
  );

  assert.equal(orchestratable.length, 17);

  for (const definition of orchestratable) {
    assert.equal(definition.integration, "internal-api", definition.id);
    assert.match(definition.apiEndpoint, /^\/api\//, definition.id);

    const routePath = `app${definition.apiEndpoint}/route.ts`;
    await access(new URL(routePath, rootUrl));

    const routeSource = await source(routePath);
    assert.match(
      routeSource,
      /getN8nWebhookConfig\("N8N_[A-Z_]+_WEBHOOK_URL"\)/,
      `${definition.id} must use server-side webhook configuration`
    );
    assert.match(routeSource, /webhook\.headers/);
    assert.doesNotMatch(routeSource, /https?:\/\/[^"']*n8n\.cloud/i);
  }
});

test("orchestratable frontends use internal APIs and expose no n8n URLs", async () => {
  for (const [moduleId, frontendPath] of Object.entries(frontendFiles)) {
    const definition = AI_MODULES.find((candidate) => candidate.id === moduleId);
    assert.ok(definition?.orchestrationReady, moduleId);

    const frontendSource = await source(frontendPath);
    assert.ok(
      frontendSource.includes(`"${definition.apiEndpoint}"`),
      `${moduleId} frontend must call ${definition.apiEndpoint}`
    );
    assert.doesNotMatch(
      frontendSource,
      /https:\/\/rohitm2026\.app\.n8n\.cloud/,
      `${moduleId} frontend must not expose a production webhook`
    );
  }
});

test("non-orchestratable modules cannot be invoked through the registry", () => {
  const unavailable = AI_MODULES.filter(
    (definition) => !definition.orchestrationReady
  ).map((definition) => definition.id);

  assert.deepEqual(unavailable.sort(), ["ai-manager", "creative-ai"]);
});
