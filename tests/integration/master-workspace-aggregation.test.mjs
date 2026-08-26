import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  selectLatestWorkspaceOutputs,
  workspaceProjectPresentation,
  workspaceSectionState,
} from "../../app/api/master-workspace/route.ts";

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

test("confirmed Business DNA is the workspace project source with safe legacy fallbacks", () => {
  const project = {
    id: "project-1", name: "Business Vision 39012ee0", companyName: "Legacy Company",
    industry: "Legacy industry", goal: "Legacy goal", originalBrief: "Legacy brief", brandDescription: null,
  };
  const canonical = workspaceProjectPresentation(project, {
    identity: { businessName: "BrightReach Digital", industry: "Digital marketing" },
    goals: { primaryGoal: "Generate qualified enquiries" },
  });
  assert.equal(canonical.name, "BrightReach Digital");
  assert.equal(canonical.companyName, "BrightReach Digital");
  assert.equal(canonical.industry, "Digital marketing");
  assert.equal(canonical.goal, "Generate qualified enquiries");

  const fallback = workspaceProjectPresentation(project, { identity: {}, goals: {} });
  assert.equal(fallback.companyName, "Legacy Company");
  assert.equal(fallback.industry, "Legacy industry");
  assert.equal(fallback.goal, "Legacy goal");
});

test("workspace preserves generated and not-generated module status mapping", () => {
  const ready = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"];
  const absent = ["logo", "content", "analytics"];
  assert.deepEqual(ready.map(() => workspaceSectionState(true)), ready.map(() => "Ready"));
  assert.deepEqual(absent.map(() => workspaceSectionState(false)), absent.map(() => "Not generated"));
  assert.equal(workspaceSectionState(true, "In progress"), "In progress");
  assert.equal(workspaceSectionState(true, "Needs attention"), "Needs attention");
});
