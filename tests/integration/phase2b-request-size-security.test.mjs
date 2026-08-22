import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AI_REQUEST_BODY_LIMIT_BYTES,
  readValidatedAiRequest,
  validateAiRequestBody,
} from "../../app/lib/ai-request-validation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function request(body) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const projectContext = {
  companyName: "Example",
  industry: "Technology",
  businessDescription: "A normal project description.",
  targetAudience: "Small businesses",
  goal: "Grow",
  brandStyle: "Modern",
};

const fixtures = {
  analytics: {
    projectId: "project-1", companyName: "Example", industry: "Technology",
    monthlyVisitors: "1000", monthlyLeads: "20", monthlySales: "5",
    monthlyRevenue: "10000", marketingBudget: "1000", businessGoal: "Grow",
    businessDescription: "Description", salesContext: { conversionRate: 2 },
  },
  branding: { projectId: "project-1", companyName: "Example", industry: "Technology", targetAudience: "SMBs", brandStyle: "Modern", brandDescription: "Description" },
  website: { projectId: "project-1", companyName: "Example", industry: "Technology", targetAudience: "SMBs", brandStyle: "Modern", brandDescription: "Description" },
  marketing: { projectId: "project-1", companyName: "Example", industry: "Technology", targetAudience: "SMBs", brandStyle: "Modern", brandDescription: "Description", regenerateSection: "Campaign", currentResult: { campaign: "Existing" }, editInstruction: "Make concise", mode: "edit" },
  seo: { projectId: "project-1", companyName: "Example", industry: "Technology", targetAudience: "SMBs", brandStyle: "Modern", brandDescription: "Description" },
  uiux: { projectId: "project-1", companyName: "Example", industry: "Technology", targetAudience: "SMBs", brandStyle: "Modern", brandDescription: "Description" },
  sales: { projectId: "project-1", companyName: "Example", industry: "Technology", salesGoal: "Grow", targetAudience: "SMBs", businessDescription: "Description" },
  content: { projectId: "project-1", prompt: "Write a launch post", contentType: "Post", tone: "Clear", audience: "SMBs", length: "Medium", keywords: "launch" },
  presentation: { projectId: "project-1", topic: "Launch", presentationType: "Pitch", audience: "Investors", tone: "Professional", slideCount: "8", keyPoints: "Growth", designStyle: "Modern", projectContext },
  logo: { projectId: "project-1", companyName: "Example", industry: "Technology", brandStyle: "Modern", logoIdea: "Abstract mark" },
  image: { projectId: "project-1", prompt: "Product hero image", style: "Modern", size: "Square", projectContext },
  video: { projectId: "project-1", prompt: "Product launch", style: "Cinematic", duration: "4 seconds", videoType: "Ad", scene: "Studio", cameraMovement: "Pan", lighting: "Soft", importantDetails: "Show product", negativePrompt: "No text", colorPalette: "Blue", aspectRatio: "16:9", projectContext },
  "automation-content": { projectId: "project-1", businessName: "Example", contentType: "Post", targetAudience: "SMBs", tone: "Clear", topic: "Launch", instructions: "Write clearly", projectContext },
  "automation-email": { projectId: "project-1", businessName: "Example", targetAudience: "SMBs", tone: "Clear", topic: "Launch", instructions: "Write clearly", projectContext },
  "automation-social": { projectId: "project-1", businessName: "Example", targetAudience: "SMBs", platform: "LinkedIn", postType: "Post", tone: "Clear", topic: "Launch", instructions: "Write clearly", projectContext },
  "automation-workflow": { projectId: "project-1", workflowName: "Lead follow-up", automationGoal: "Follow up", trigger: "New lead", workflowSteps: "Send email", additionalInstructions: "Keep concise", projectContext },
  "automation-pipeline": { projectId: "project-1", businessName: "Example", pipelineGoal: "Qualify leads", capabilities: "Scoring", instructions: "Keep concise", projectContext },
};

test("all seventeen current client payloads pass bounded validation", () => {
  for (const [schema, body] of Object.entries(fixtures)) {
    assert.ok(validateAiRequestBody(schema, body), `${schema} should validate`);
  }
});

test("shared reader returns 413 for bodies over 16 KB", async () => {
  const result = await readValidatedAiRequest(
    request({ ...fixtures.content, prompt: "x".repeat(17 * 1024) }),
    "content",
  );
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
  assert.equal(AI_REQUEST_BODY_LIMIT_BYTES, 16 * 1024);
});

test("shared reader returns 400 for malformed JSON", async () => {
  const result = await readValidatedAiRequest(request('{"projectId":'), "content");
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 400);
});

test("text AI rejects long descriptions and unsafe unknown fields", () => {
  assert.equal(validateAiRequestBody("branding", {
    ...fixtures.branding,
    brandDescription: "x".repeat(4_001),
  }), null);
  assert.equal(validateAiRequestBody("content", {
    ...fixtures.content,
    arbitraryNestedData: { unsafe: true },
  }), null);
});

test("Image AI bounds prompts and requires string select fields", () => {
  assert.equal(validateAiRequestBody("image", { ...fixtures.image, prompt: "x".repeat(4_001) }), null);
  assert.equal(validateAiRequestBody("image", { ...fixtures.image, style: { unsafe: true } }), null);
  assert.equal(validateAiRequestBody("image", { ...fixtures.image, size: 123 }), null);
});

test("Video AI bounds detailed text and requires string select fields", () => {
  assert.equal(validateAiRequestBody("video", { ...fixtures.video, importantDetails: "x".repeat(4_001) }), null);
  assert.equal(validateAiRequestBody("video", { ...fixtures.video, duration: 4 }), null);
  assert.equal(validateAiRequestBody("video", { ...fixtures.video, aspectRatio: ["16:9"] }), null);
  assert.equal(validateAiRequestBody("video", { ...fixtures.video, style: null }), null);
});

test("Automation schemas bound IDs, instructions, and nested input", () => {
  assert.equal(validateAiRequestBody("automation-content", { ...fixtures["automation-content"], projectId: "x".repeat(129) }), null);
  assert.equal(validateAiRequestBody("automation-email", { ...fixtures["automation-email"], instructions: "x".repeat(4_001) }), null);
  assert.equal(validateAiRequestBody("automation-social", { ...fixtures["automation-social"], unsafe: true }), null);
  assert.equal(validateAiRequestBody("automation-workflow", { ...fixtures["automation-workflow"], workflowSteps: { unsafe: true } }), null);
  assert.equal(validateAiRequestBody("automation-pipeline", null), null);
});

test("target routes validate after authentication and before provider fetch", async () => {
  const routes = [
    "analytics-ai", "branding-ai", "website-ai", "marketing-ai", "seo-ai", "uiux-ai",
    "sales-ai", "content-ai", "presentation-ai", "logo-ai", "image-ai", "video-ai",
  ];
  for (const route of routes) {
    const contents = await source(`app/api/${route}/route.ts`);
    const auth = contents.indexOf("verifyFirebaseIdToken(request)");
    const validation = contents.indexOf("readValidatedAiRequest(request");
    const provider = contents.indexOf("fetch(webhook.url");
    assert.ok(auth >= 0 && validation > auth, `${route} must authenticate first`);
    assert.ok(provider < 0 || validation < provider, `${route} must validate before provider fetch`);
  }

  const automationAuth = await source("app/lib/automation-auth.ts");
  assert.ok(
    automationAuth.indexOf("verifyFirebaseIdToken(request)") <
      automationAuth.indexOf("readValidatedAiRequest(request"),
  );
});
