import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { unwrapMarketingProviderResponse } from "../../app/lib/marketing-provider-response.ts";

const route = fs.readFileSync("app/api/marketing-ai/route.ts", "utf8");
const page = fs.readFileSync("app/marketing-ai/page.tsx", "utf8");
const persistence = fs.readFileSync("app/lib/marketing-generation-persistence.ts", "utf8");

test("provider keeps its legacy flat input contract alongside connected context", () => {
  for (const field of ["companyName", "industry", "targetAudience", "brandStyle", "brandDescription"]) {
    assert.match(route, new RegExp(`${field}: context\\.business\\.`));
  }
  assert.match(route, /connectedBusinessContext: context/);
  assert.doesNotMatch(route, /companyName: body\.companyName/);
});

test("valid direct and n8n-wrapped Marketing results normalize", () => {
  const strategy = { marketingStrategy: "Use the approved website." };
  assert.deepEqual(unwrapMarketingProviderResponse(strategy), strategy);
  assert.deepEqual(unwrapMarketingProviderResponse({ output: JSON.stringify(strategy) }), strategy);
  assert.deepEqual(unwrapMarketingProviderResponse([{ text: { output: strategy } }]), strategy);
});

test("malformed and empty provider responses fail closed", () => {
  assert.equal(unwrapMarketingProviderResponse(""), null);
  assert.equal(unwrapMarketingProviderResponse("not json"), null);
  assert.equal(unwrapMarketingProviderResponse([]), null);
  assert.equal(unwrapMarketingProviderResponse([{}, {}]), null);
  assert.match(route, /Marketing AI returned invalid JSON/);
});

test("valid API result renders immediately and refresh restores saved output", () => {
  assert.match(page, /setBrandResult\(data\.marketingStrategy as MarketingResult\)/);
  assert.match(route, /readStoredMarketingInsights/);
  assert.match(page, /setBrandResult\(data\.marketingStrategy \?\? null\)/);
  assert.match(page, /data\?\.error \|\| `Marketing request failed/);
});

test("output persistence precedes successful usage and failures release allowance", () => {
  assert.match(route, /persistCompletedMarketingGeneration/);
  assert.match(route, /Your allowance was restored/);
  assert.match(persistence, /transaction\.update\(projectOutputs\)/);
  assert.match(persistence, /eq\(aiUsage\.status, "started"\)/);
  assert.match(persistence, /status: "success"/);
});
