import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeContracts = [
  ["app/api/ai-manager/route.ts", "N8N_AI_MANAGER_WEBHOOK_URL", "json"],
  ["app/api/analytics-ai/route.ts", "N8N_ANALYTICS_AI_WEBHOOK_URL", "json"],
  ["app/api/branding-ai/route.ts", "N8N_BRANDING_AI_WEBHOOK_URL", "json"],
  ["app/api/content-ai/route.ts", "N8N_CONTENT_AI_WEBHOOK_URL", "json"],
  ["app/api/image-ai/route.ts", "N8N_IMAGE_AI_WEBHOOK_URL", "image/png"],
  ["app/api/logo-ai/route.ts", "N8N_LOGO_AI_WEBHOOK_URL", "json"],
  ["app/api/marketing-ai/route.ts", "N8N_MARKETING_AI_WEBHOOK_URL", "json"],
  ["app/api/presentation-ai/route.ts", "N8N_PRESENTATION_AI_WEBHOOK_URL", "json"],
  ["app/api/sales-ai/route.ts", "N8N_SALES_AI_WEBHOOK_URL", "json"],
  ["app/api/seo-ai/route.ts", "N8N_SEO_AI_WEBHOOK_URL", "json"],
  ["app/api/uiux-ai/route.ts", "N8N_UIUX_AI_WEBHOOK_URL", "json"],
  ["app/api/video-ai/route.ts", "N8N_VIDEO_AI_WEBHOOK_URL", "video/mp4"],
  ["app/api/website-ai/route.ts", "N8N_WEBSITE_AI_WEBHOOK_URL", "json"],
  ["app/api/automation/content/route.ts", "N8N_AUTOMATION_CONTENT_WEBHOOK_URL", "json"],
  ["app/api/automation/email/route.ts", "N8N_AUTOMATION_EMAIL_WEBHOOK_URL", "json"],
  ["app/api/automation/social/route.ts", "N8N_AUTOMATION_SOCIAL_WEBHOOK_URL", "json"],
  ["app/api/automation/workflow/route.ts", "N8N_AUTOMATION_WORKFLOW_WEBHOOK_URL", "json"],
  ["app/api/automation/pipeline/route.ts", "N8N_AUTOMATION_PIPELINE_WEBHOOK_URL", "json"],
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

for (const [path, environmentVariable, outputKind] of routeContracts) {
  test(`${path} preserves its production proxy contract`, async () => {
    const contents = await source(path);
    assert.match(contents, /export\s+async\s+function\s+POST\s*\(/);
    assert.ok(contents.includes(environmentVariable), `Expected ${environmentVariable}`);
    assert.match(contents, /getN8nWebhookConfig\(/);
    assert.match(contents, /n8nConfigurationErrorResponse\(\)/);
    assert.match(contents, /fetch\(webhook\.url/);
    assert.match(contents, /webhook\.headers/);
    assert.doesNotMatch(contents, /https?:\/\/[^"']*n8n\.cloud/i);
    const configGuard = contents.indexOf("const webhook = getN8nWebhookConfig");
    const usageStart = contents.indexOf("usageId = await startAiUsage");
    const upstreamFetch = contents.indexOf("fetch(webhook.url");
    assert.ok(configGuard >= 0 && configGuard < usageStart);
    assert.ok(configGuard < upstreamFetch);
    assert.match(contents, /method:\s*["']POST["']/);
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

test("n8n webhook configuration is server-only and authenticated", async () => {
  const contents = await source("app/lib/n8n-webhooks.ts");
  assert.match(contents, /^import "server-only";/);
  assert.match(contents, /process\.env\.N8N_WEBHOOK_SECRET/);
  assert.match(contents, /X-Buzypeezy-Webhook-Secret/);
  assert.doesNotMatch(contents, /NEXT_PUBLIC_/);
});

test("n8n proxy routes never return raw upstream error bodies", async () => {
  for (const [path] of routeContracts) {
    const contents = await source(path);
    assert.doesNotMatch(contents, /n8nResponse\s*:/);
    assert.doesNotMatch(contents, /new Response\((?:responseText|errorText)\s*\|\|/);
  }
});

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
