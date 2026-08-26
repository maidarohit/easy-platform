import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { requestBusinessIntakeAnalysis, BusinessIntakeProviderError, BUSINESS_INTAKE_MAX_OUTPUT_TOKENS } from "../../app/lib/business-intake-provider.ts";
import { handleBusinessDnaAnalyze } from "../../app/api/business-dna/analyze/route.ts";
import { materializeBusinessDna } from "../../app/lib/business-dna.ts";

const input = { preferredLanguage: "english", originalVisionText: "A bakery in Pune", savedDna: {} };
const validAnalysis = { extractedDna: { location: { city: "Pune" } }, confidence: {}, missingAreas: ["customers"], suggestedQuestions: [{ id: "desired-customers", dnaPath: "customers.desiredCustomers", question: "Who do you want to reach?", reason: "It shapes the plan.", required: true, answerType: "textarea", options: [] }], understandingSummary: "A Pune bakery.", buildPlanSummary: ["A local customer plan"] };
const response = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const rawMessage = (...content) => ({ status: "completed", output: [{ type: "reasoning", content: [{ type: "reasoning_text", text: "ignored" }] }, { type: "message", role: "assistant", content }] });

test("1 provider 4xx is classified distinctly", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(400, { error: { code: "invalid_json_schema" } }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "provider_http" && error.httpStatus === 400 && error.safeCode === "invalid_json_schema");
});

test("2 provider 5xx is classified distinctly", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(503, { error: { type: "server_error" } }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "provider_http" && error.httpStatus === 503 && error.safeCode === "server_error");
});

test("3 valid provider result parses", async () => {
  const result = await requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, { ...rawMessage({ type: "output_text", text: JSON.stringify(validAnalysis) }), usage: { input_tokens: 10, output_tokens: 20 } }) });
  assert.equal(result.analysis.extractedDna.location.city, "Pune"); assert.equal(result.inputTokens, 10);
});

test("4 invalid structured output reports safe validation paths", async () => {
  const invalid = structuredClone(validAnalysis); invalid.suggestedQuestions[0].dnaPath = "identity.revenue";
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, { output_text: JSON.stringify(invalid) }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.stage === "schema_validation" && error.issuePaths.includes("suggestedQuestions.0.dnaPath"));
});

test("5 incomplete max-token response is detected before JSON.parse", async () => {
  const partial = '{"extractedDna":{"location":{"city":"Pune"}';
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "message", content: [{ type: "output_text", text: partial }] }] }) }),
    (error) => error instanceof BusinessIntakeProviderError && error.safeCode === "incomplete_max_output_tokens" && error.responseDiagnostics?.extractedTextLength === partial.length);
});

test("6 refusal is detected before JSON.parse", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, rawMessage({ type: "refusal", refusal: "not logged" })) }),
    (error) => error instanceof BusinessIntakeProviderError && error.safeCode === "refusal");
});

test("7 completed response without output text is classified safely", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, rawMessage()) }),
    (error) => error instanceof BusinessIntakeProviderError && error.safeCode === "missing_output_text");
});

test("8 multiple canonical output-text blocks are assembled in order", async () => {
  const json = JSON.stringify(validAnalysis); const split = Math.floor(json.length / 2);
  const result = await requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, rawMessage({ type: "output_text", text: json.slice(0, split) }, { type: "annotation", text: "ignored" }, { type: "output_text", text: json.slice(split) })) });
  assert.equal(result.analysis.understandingSummary, "A Pune bakery.");
});

test("9 malformed completed output is rejected without repair", async () => {
  await assert.rejects(requestBusinessIntakeAnalysis(input, { apiKey: "mock", fetcher: response(200, rawMessage({ type: "output_text", text: "```json not accepted```" })) }),
    (error) => error instanceof BusinessIntakeProviderError && error.safeCode === "invalid_output_json" && error.responseDiagnostics?.beginsWithJsonObject === false);
});

test("10 output budget is raised to the compact audited bound", () => assert.equal(BUSINESS_INTAKE_MAX_OUTPUT_TOKENS, 8_000));

function dna() { return materializeBusinessDna({ content: { conversation: { originalVisionText: "Saved vision", preferredLanguage: "english" } }, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) }); }
function request() { return new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "same-request" }) }); }

test("11 provider failure preserves usage failure state", async () => {
  const oldFlag = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; const oldKey = process.env.OPENAI_API_KEY;
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true"; process.env.OPENAI_API_KEY = "mock"; let failed = false;
  const originalError = console.error; console.error = () => {};
  try {
    const result = await handleBusinessDnaAnalyze(request(), { verify: async () => ({ uid: "owner" }), read: async () => dna(), update: async () => dna(), claimUsage: async () => ({ usageId: "u1", created: true, status: "started" }), provider: async () => { throw new BusinessIntakeProviderError("provider_http", "server_error", 500); }, completeUsage: async () => {}, failUsage: async () => { failed = true; } });
    assert.equal(result.status, 502); assert.equal(failed, true);
  } finally { console.error = originalError; process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = oldFlag; process.env.OPENAI_API_KEY = oldKey; }
});

test("12 customer Business DNA remains intact after failure", async () => {
  const saved = dna(); const snapshot = structuredClone(saved); assert.deepEqual(saved, snapshot);
});

test("13 duplicate idempotent request does not call provider or create usage", async () => {
  const oldFlag = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; const oldKey = process.env.OPENAI_API_KEY;
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true"; process.env.OPENAI_API_KEY = "mock"; let providerCalls = 0;
  try {
    const result = await handleBusinessDnaAnalyze(request(), { verify: async () => ({ uid: "owner" }), read: async () => dna(), update: async () => dna(), claimUsage: async () => ({ usageId: "existing", created: false, status: "failed" }), provider: async () => { providerCalls += 1; return { analysis: validAnalysis }; }, completeUsage: async () => {}, failUsage: async () => {} });
    assert.equal(result.status, 409); assert.equal(providerCalls, 0);
  } finally { process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = oldFlag; process.env.OPENAI_API_KEY = oldKey; }
});

test("14 no automatic provider retry exists", async () => assert.doesNotMatch(await readFile("app/lib/business-intake-provider.ts", "utf8"), /for\s*\([^)]*retry|while\s*\(|retry\s*\(/i));
test("15 analysis route cannot start Easy Mode", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /executeEasyMode|easyModeRuns|\/api\/easy-mode/));
test("16 analysis route cannot start specialists", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /n8n|executeValidatedJsonWebhook|branding-execution|text-specialist/i));
test("17 forensic suite uses zero real provider calls", async () => {
  const source = await readFile("tests/integration/business-intake-forensics.test.mjs", "utf8");
  assert.doesNotMatch(source, /api\.openai\.com|OPENAI_API_KEY\s*=\s*process\.env/); assert.match(source, /fetcher: response/);
});
