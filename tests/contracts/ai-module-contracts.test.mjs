import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeContracts = [
  ["app/api/ai-manager/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/ai-manager", "json"],
  ["app/api/analytics-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/analytics-ai", "json"],
  ["app/api/branding-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/branding-api", "json"],
  ["app/api/content-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/content-ai", "json"],
  ["app/api/image-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/image-ai", "image/png"],
  ["app/api/logo-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/logo-ai", "json"],
  ["app/api/marketing-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/658e225f-8eca-47c7-b5d7-643d15deed25", "json"],
  ["app/api/presentation-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/presentation-ai", "json"],
  ["app/api/sales-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/afe45d44-0079-4e61-8631-7b72059f5e17", "json"],
  ["app/api/seo-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/dff50e4b-b682-4001-aa03-f83ef3abf782", "json"],
  ["app/api/uiux-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/uiux-ai", "json"],
  ["app/api/video-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/video-ai", "video/mp4"],
  ["app/api/website-ai/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/c5d5e244-e62c-4634-b353-0175b9793c32", "json"],
  ["app/api/automation/content/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/automation-content", "json"],
  ["app/api/automation/email/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/automation-email", "json"],
  ["app/api/automation/social/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/automation-social", "json"],
  ["app/api/automation/workflow/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/automation-workflow", "json"],
  ["app/api/automation/pipeline/route.ts", "https://rohitm2026.app.n8n.cloud/webhook/automation-pipeline", "json"],
];

const frontendContracts = [
  ["app/ai-manager/page.tsx", "/api/ai-manager", ["companyName", "businessDescription", "industry", "businessGoal"]],
  ["app/analytics-ai/page.tsx", "/api/analytics-ai", ["companyName", "industry", "monthlyVisitors", "monthlyLeads", "monthlySales", "monthlyRevenue", "marketingBudget", "businessGoal", "businessDescription"]],
  ["app/branding-ai/page.tsx", "/api/branding-ai", ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]],
  ["app/dashboard/website-ai/page.tsx", "/api/website-ai", ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]],
  ["app/marketing-ai/page.tsx", "/api/marketing-ai", ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]],
  ["app/sales-ai/page.tsx", "/api/sales-ai", ["companyName", "industry", "salesGoal", "targetAudience", "businessDescription"]],
  ["app/seo-ai/page.tsx", "/api/seo-ai", ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]],
  ["app/uiux-ai/page.tsx", "/api/uiux-ai", ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]],
  ["app/dashboard/content-ai/page.tsx", "/api/content-ai", ["prompt", "contentType", "tone", "audience", "length", "keywords"]],
  ["app/dashboard/logo-ai/page.tsx", "/api/logo-ai", ["companyName", "industry", "brandStyle", "logoIdea"]],
  ["app/dashboard/image-ai/page.tsx", "/api/image-ai", ["prompt", "style", "size"]],
  ["app/dashboard/presentation-ai/page.tsx", "/api/presentation-ai", ["topic", "presentationType", "audience", "tone", "slideCount", "keyPoints", "designStyle"]],
  ["app/dashboard/video-ai/page.tsx", "/api/video-ai", ["prompt", "style", "duration", "videoType", "scene", "cameraMovement", "lighting", "importantDetails", "negativePrompt", "colorPalette", "aspectRatio"]],
];

const automationFields = {
  content: ["businessName", "contentType", "targetAudience", "tone", "topic", "instructions"],
  email: ["businessName", "targetAudience", "tone", "topic", "instructions"],
  social: ["businessName", "targetAudience", "platform", "postType", "tone", "topic", "instructions"],
  workflow: ["businessName", "automationGoal", "trigger", "actions", "tools", "instructions"],
  pipeline: ["businessName", "pipelineGoal", "capabilities", "instructions"],
};

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

for (const [path, webhook, outputKind] of routeContracts) {
  test(`${path} preserves its production proxy contract`, async () => {
    const contents = await source(path);
    assert.match(contents, /export\s+async\s+function\s+POST\s*\(/);
    assert.ok(contents.includes(webhook), `Expected production webhook ${webhook}`);
    assert.match(contents, /method:\s*["']POST["']/);
    assert.match(contents, /["']Content-Type["']:\s*["']application\/json["']/);
    assert.match(
      contents,
      /body:\s*JSON\.stringify\((?:body|payload|[a-z]+Payload)\)/,
    );

    if (outputKind === "image/png" || outputKind === "video/mp4") {
      assert.ok(contents.includes(`"Content-Type": "${outputKind}"`));
      assert.match(contents, /\.arrayBuffer\(\)/);
    }
  });
}

for (const [path, endpoint, fields] of frontendContracts) {
  test(`${path} preserves its generation request`, async () => {
    const contents = await source(path);
    assert.ok(contents.includes(endpoint), `Expected frontend endpoint ${endpoint}`);
    assert.match(contents, /method:\s*["']POST["']/);
    for (const field of fields) {
      assert.match(contents, new RegExp(`\\b${field}\\b`), `Missing payload field ${field}`);
    }
  });
}

test("Automation Hub preserves all five API endpoints and payload fields", async () => {
  const contents = await source("app/dashboard/automation/page.tsx");
  for (const [module, fields] of Object.entries(automationFields)) {
    assert.ok(contents.includes(`/api/automation/${module}`));
    for (const field of fields) {
      assert.match(contents, new RegExp(`\\b${field}\\b`), `${module}: missing ${field}`);
    }
  }
});

test("Marketing projects use authenticated database persistence", async () => {
  const modulePage = await source("app/marketing-ai/page.tsx");
  const projectsPage = await source("app/marketing-ai/projects/page.tsx");
  assert.ok(modulePage.includes('module: "marketing"'));
  assert.ok(modulePage.includes('authenticatedFetch("/api/project-outputs"'));
  assert.ok(projectsPage.includes("authenticatedFetch("));
  assert.ok(projectsPage.includes("/api/projects?userId="));
});
