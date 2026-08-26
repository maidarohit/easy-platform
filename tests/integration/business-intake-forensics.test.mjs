import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { requestBusinessIntakeAnalysis, BusinessIntakeProviderError } from "../../app/lib/business-intake-provider.ts";
import { handleBusinessDnaAnalyze } from "../../app/api/business-dna/analyze/route.ts";
import { materializeBusinessDna } from "../../app/lib/business-dna.ts";

const input = { preferredLanguage: "english", originalVisionText: "A bakery in Pune", savedDna: {} };
const validAnalysis = { extractedDna: { location: { city: "Pune" } }, confidence: {}, missingAreas: ["customers"], suggestedQuestions: [{ id: "desired-customers", dnaPath: "customers.desiredCustomers", question: "Who do you want to reach?", reason: "It shapes the plan.", required: true, answerType: "textarea", options: [] }], understandingSummary: "A Pune bakery.", buildPlanSummary: ["A local customer plan"] };
const response = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("1 provider 4xx is classified distinctly", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(400, { error: { code: "invalid_json_schema" } }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "provider_http" && error.httpStatus === 400 && error.safeCode === "invalid_json_schema");
});

test("2 provider 5xx is classified distinctly", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(503, { error: { type: "server_error" } }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "provider_http" && error.httpStatus === 503 && error.safeCode === "server_error");
});

test("3 valid provider result parses", async () => {
  const result = await requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, { output_text: JSON.stringify(validAnalysis), usage: { input_tokens: 10, output_tokens: 20 } }) });
  assert.equal(result.analysis.extractedDna.location.city, "Pune"); assert.equal(result.inputTokens, 10);
});

test("4 invalid structured output reports safe validation paths", async () => {
  const invalid = structuredClone(validAnalysis); invalid.suggestedQuestions[0].dnaPath = "identity.revenue";
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, { output_text: JSON.stringify(invalid) }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "schema_validation" && error.issuePaths.includes("suggestedQuestions.0.dnaPath"));
});

function dna() { return materializeBusinessDna({ content: { conversation: { originalVisionText: "Saved vision", preferredLanguage: "english" } }, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) }); }
function request() { return new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "same-request" }) }); }

test("5 provider failure preserves usage failure state", async () => {
  const oldFlag = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; const oldKey = process.env.OPENAI_API_KEY;
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true"; process.env.OPENAI_API_KEY = "mock"; let failed = false;
  const originalError = console.error; console.error = () => {};
  try {
    const result = await handleBusinessDnaAnalyze(request(), { verify: async () => ({ uid: "owner" }), read: async () => dna(), claimUsage: async () => ({ usageId: "u1", created: true, status: "started" }), provider: async () => { throw new BusinessIntakeProviderError("provider_http", "server_error", 500); }, completeUsage: async () => {}, failUsage: async () => { failed = true; } });
    assert.equal(result.status, 502); assert.equal(failed, true);
  } finally { console.error = originalError; process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = oldFlag; process.env.OPENAI_API_KEY = oldKey; }
});

test("6 customer Business DNA remains intact after failure", async () => {
  const saved = dna(); const snapshot = structuredClone(saved); assert.deepEqual(saved, snapshot);
});

test("7 duplicate idempotent request does not call provider or create usage", async () => {
  const oldFlag = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; const oldKey = process.env.OPENAI_API_KEY;
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true"; process.env.OPENAI_API_KEY = "mock"; let providerCalls = 0;
  try {
    const result = await handleBusinessDnaAnalyze(request(), { verify: async () => ({ uid: "owner" }), read: async () => dna(), claimUsage: async () => ({ usageId: "existing", created: false, status: "failed" }), provider: async () => { providerCalls += 1; return { analysis: validAnalysis }; }, completeUsage: async () => {}, failUsage: async () => {} });
    assert.equal(result.status, 409); assert.equal(providerCalls, 0);
  } finally { process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = oldFlag; process.env.OPENAI_API_KEY = oldKey; }
});

test("8 analysis route cannot start Easy Mode", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /executeEasyMode|easyModeRuns|\/api\/easy-mode/));
test("9 analysis route cannot start specialists", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /n8n|executeValidatedJsonWebhook|branding-execution|text-specialist/i));
test("10 forensic suite uses zero real provider calls", async () => {
  const source = await readFile("tests/integration/business-intake-forensics.test.mjs", "utf8");
  assert.doesNotMatch(source, /api\.openai\.com|OPENAI_API_KEY\s*=\s*process\.env/); assert.match(source, /fetcher: response/);
});
