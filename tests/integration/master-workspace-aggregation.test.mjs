import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectLatestWorkspaceOutputs } from "../../app/api/master-workspace/route.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const branding = {
  brandName: "Newest Brand", tagline: "Useful", story: "Story", mission: "Mission", vision: "Vision",
  brandVoice: "Clear", colorPalette: "Blue", typography: "Sans", logoConcept: "Mark",
  marketingSuggestions: "Share value", brandStyleGuide: "Be clear",
};

test("owner-scoped workspace API authenticates and blocks cross-tenant project access", async () => {
  const route = await source("app/api/master-workspace/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /eq\(easyModeRuns\.userId, userId\)/);
  assert.match(route, /status: 404/);
});

test("latest valid output wins per module and invalid newer data is skipped safely", () => {
  const latest = selectLatestWorkspaceOutputs([
    { module: "branding", result: JSON.stringify({ arbitrary: "invalid" }) },
    { module: "branding-ai", result: JSON.stringify(branding) },
    { module: "branding", result: JSON.stringify({ ...branding, brandName: "Older Brand" }) },
  ]);
  assert.equal(latest.get("branding")?.output.brandName, "Newest Brand");
});

test("missing modules return explicit safe empty states without generation paths", async () => {
  const route = await source("app/api/master-workspace/route.ts");
  const page = await source("app/master-workspace/page.tsx");
  assert.match(route, /"Not generated"/);
  assert.match(route, /"In progress"/);
  assert.match(route, /output: latest\.get\(module\)\?\.output \?\? null/);
  assert.match(page, /View latest output/);
  assert.doesNotMatch(route, /startAiUsage|completeAiUsage|fetch\(|N8N_|publish|insert\(|update\(|delete\(/);
});
