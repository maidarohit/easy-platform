import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { restoreAiManagerStrategy } from "../../app/lib/ai/restore-manager-strategy.ts";

const strategy = Object.fromEntries(
  ["overview", "branding", "website", "marketing", "seo", "uiux", "sales", "analytics"]
    .map(key => [key, `${key} saved content\nSecond paragraph.`]),
);

test("restores all eight current saved module sections without changing their text", () => {
  assert.deepEqual(restoreAiManagerStrategy(JSON.stringify(strategy)), strategy);
  assert.deepEqual(restoreAiManagerStrategy(strategy), strategy);
});

test("unwraps saved job envelopes and legacy serialized/single-item results", () => {
  for (const saved of [
    { output: strategy }, { result: { output: strategy } }, [{ output: strategy }],
    { output: JSON.stringify(strategy) }, JSON.stringify(JSON.stringify({ output: strategy })),
  ]) {
    const restored = restoreAiManagerStrategy(JSON.stringify(saved));
    assert.deepEqual(restored, strategy);
    for (const key of Object.keys(strategy)) assert.equal(restored[key], strategy[key]);
  }
});

test("malformed, incomplete, or ambiguous data cannot produce eight empty cards", () => {
  for (const saved of [null, "broken json", {}, [], [strategy, strategy],
    { ...strategy, overview: {} }, { ...strategy, analytics: " " },
    { output: strategy, result: { ...strategy, overview: "Different strategy" } },
  ]) assert.equal(restoreAiManagerStrategy(saved), null);
  const cyclic = {}; cyclic.output = cyclic;
  assert.equal(restoreAiManagerStrategy(cyclic), null);
});

test("rejects Website AI data stored in the legacy project result instead of displaying blank strategy cards", () => {
  // Field shape observed on the affected project; no production content copied.
  const website = Object.fromEntries([
    "websiteOverview", "websiteGoal", "recommendedPages", "siteStructure",
    "websiteFeatures", "designRecommendations", "colourScheme", "typography",
    "recommendedTechStack", "seoRecommendations",
  ].map(key => [key, `${key} saved website content`]));
  const saved = JSON.stringify(website);
  const oldResult = JSON.parse(saved);
  for (const key of Object.keys(strategy)) assert.equal(String(oldResult[key] ?? ""), "");
  assert.equal(restoreAiManagerStrategy(saved), null);
  assert.equal(restoreAiManagerStrategy({ output: website }), null);
});

test("both restoration sources normalize data and retain project-scoped loading", async () => {
  const page = await readFile(new URL("../../app/ai-manager/page.tsx", import.meta.url), "utf8");
  assert.match(page, /restoreAiManagerStrategy\(project\.result\)/);
  assert.match(page, /restoreAiManagerStrategy\(data\.output\.result\)/);
  assert.match(page, /project\.id !== requestedProjectId/);
  assert.match(page, /projectId=\$\{encodeURIComponent\(project\.id\)\}&module=ai-manager/);
  assert.match(page, /if \(!active \|\| !data\.output\?\.result\) return/);
  assert.doesNotMatch(page, /JSON\.parse\([^\n]+\) as AiManagerStrategy/);
});
