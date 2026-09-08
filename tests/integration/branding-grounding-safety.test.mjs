import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStoredBrandingOutput, sanitizeBrandingOutput } from "../../app/lib/branding-insight-safety.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const input = { companyName: "Acme Design", industry: "Interior Design", targetAudience: "Homeowners", brandStyle: "Modern", brandDescription: "Interior design services for homeowners." };
const fields = ["brandName", "tagline", "story", "mission", "vision", "brandVoice", "colorPalette", "typography", "logoConcept", "marketingSuggestions", "brandStyleGuide"];
const output = (story) => Object.fromEntries(fields.map((field) => [field, field === "story" ? story : `Safe ${field}`]));

test("Branding removes unsupported history, proof and reputation claims", () => {
  const unsafe = "An award-winning firm. Founded in 2001 with 25 years of experience. Trusted by 500 clients. ISO 9001 certified. Founded by a celebrated architect. Testimonials prove our success. Guaranteed results. The number one industry-leading studio.";
  const result = sanitizeBrandingOutput(output(unsafe), input);
  assert.doesNotMatch(result.story, /award-winning|2001|25 years|500 clients|ISO 9001|celebrated architect|Testimonials prove|Guaranteed results|number one|industry-leading/i);
  assert.match(result.story, /verified award details/);
  assert.match(result.story, /verified dates or experience/);
  assert.match(result.story, /verified figures/);
  assert.match(result.story, /verified credentials/);
  assert.match(result.story, /approved business description/);
  assert.match(result.story, /approved customer proof/);
});

test("approved saved facts survive hydration while unsupported facts are normalized", () => {
  const approvedInput = { ...input, brandDescription: "Founded in 2018 and ISO 9001 certified." };
  const result = readStoredBrandingOutput(JSON.stringify(output("Founded in 2018. ISO 9001 certified. Award-winning studio.")), approvedInput);
  assert.match(result.story, /Founded in 2018/);
  assert.match(result.story, /ISO 9001 certified/);
  assert.doesNotMatch(result.story, /Award-winning studio/);
});

test("shared Branding execution sanitizes output for standalone and Easy Mode", async () => {
  const execution = await source("app/lib/branding-execution.ts");
  assert.match(execution, /sanitizeBrandingOutput\(validatedOutput, input\)/);
  assert.ok(execution.indexOf("validateOutput") < execution.indexOf("sanitizeBrandingOutput(validatedOutput, input)"));
});

test("standalone Branding uses canonical context and owner-scoped no-usage hydration", async () => {
  const [route, page] = await Promise.all([source("app/api/branding-ai/route.ts"), source("app/branding-ai/page.tsx")]);
  assert.match(route, /loadCanonicalBrandingInput\(context\)/);
  assert.doesNotMatch(route, /const brandingPayload = \{ \.\.\.body \}/);
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(get, /verifyFirebaseIdToken/);
  assert.match(get, /eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, uid\)[\s\S]*eq\(projectOutputs\.module, "branding"\)/);
  assert.match(get, /readStoredBrandingOutput/);
  assert.doesNotMatch(get, /claimIdempotentAiUsage|executeBrandingService/);
  assert.match(page, /\/api\/branding-ai\?projectId=/);
  assert.doesNotMatch(page, /authenticatedFetch\("\/api\/project-outputs"|userId:\s*currentUser\.uid/);
});

test("Branding persistence precedes success and failures release idempotent usage", async () => {
  const [route, persistence] = await Promise.all([source("app/api/branding-ai/route.ts"), source("app/lib/branding-generation-persistence.ts")]);
  assert.match(route, /claimIdempotentAiUsage/);
  assert.match(route, /requestId/);
  assert.match(route, /releaseFailedAiUsage/);
  assert.ok(route.indexOf("await persistCompletedBrandingGeneration") < route.indexOf("return Response.json({ output: result.output },"));
  assert.match(persistence, /db\.transaction/);
  assert.match(persistence, /eq\(projects\.userId, input\.userId\)/);
  assert.match(persistence, /(?:insert|update)\(projectOutputs\)/);
  assert.match(persistence, /update\(aiUsage\)[\s\S]*status: "success"[\s\S]*eq\(aiUsage\.status, "started"\)/);
});
