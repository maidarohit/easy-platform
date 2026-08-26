import "server-only";

import { BUSINESS_INTAKE_QUESTION_PATHS, businessIntakeAnalysisIssuePaths, validateBusinessIntakeAnalysis, type BusinessIntakeAnalysis, type BusinessIntakeAnalysisInput } from "@/app/lib/business-intake-analysis";

export const BUSINESS_INTAKE_MODEL = "gpt-5-mini";
export const BUSINESS_INTAKE_MAX_OUTPUT_TOKENS = 8_000;
const TIMEOUT_MS = 45_000;

export type BusinessIntakeFailureStage = "provider_http" | "provider_parse" | "schema_validation";
export class BusinessIntakeProviderError extends Error {
  readonly stage: BusinessIntakeFailureStage;
  readonly safeCode: string;
  readonly httpStatus?: number;
  readonly issuePaths: readonly string[];
  readonly responseDiagnostics?: BusinessIntakeResponseDiagnostics;
  constructor(stage: BusinessIntakeFailureStage, safeCode: string, httpStatus?: number, issuePaths: readonly string[] = [], responseDiagnostics?: BusinessIntakeResponseDiagnostics) {
    super("BUSINESS_INTAKE_ANALYSIS_FAILED"); this.name = "BusinessIntakeProviderError";
    this.stage = stage; this.safeCode = safeCode; this.httpStatus = httpStatus; this.issuePaths = issuePaths; this.responseDiagnostics = responseDiagnostics;
  }
}

export type BusinessIntakeResponseDiagnostics = Readonly<{
  responseStatus: string | null;
  incompleteReason: string | null;
  contentItemTypes: readonly string[];
  extractedTextLength: number;
  beginsWithJsonObject: boolean;
  endsWithJsonObject: boolean;
}>;

const stringField = { type: ["string", "null"], maxLength: 300 } as const;
const longStringField = { type: ["string", "null"], maxLength: 800 } as const;
const stringList = { type: ["array", "null"], maxItems: 6, items: { type: "string", maxLength: 120 } } as const;
const section = (properties: Record<string, unknown>) => ({ type: ["object", "null"], additionalProperties: false, required: Object.keys(properties), properties });

export const BUSINESS_INTAKE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["extractedDna", "confidence", "missingAreas", "suggestedQuestions", "understandingSummary", "buildPlanSummary"],
  properties: {
    extractedDna: { type: "object", additionalProperties: false, required: ["identity", "founderHistory", "location", "offer", "customers", "digitalPresence", "personality", "goals"], properties: {
      identity: section({ businessName: stringField, industry: stringField, subIndustry: stringField, businessStage: stringField }),
      founderHistory: section({ founderStory: longStringField, whyStarted: longStringField, businessAge: stringField, businessGeneration: stringField }),
      location: section({ city: stringField, region: stringField, country: stringField, serviceAreas: stringList }),
      offer: section({ products: stringList, services: stringList, strongestOffers: stringList, differentiators: stringList }),
      customers: section({ currentCustomers: longStringField, desiredCustomers: longStringField, targetAudience: longStringField }),
      digitalPresence: section({ existingWebsite: stringField, websiteStatus: longStringField, socialPresence: stringList, digitalProblems: stringList }),
      personality: section({ brandPersonality: stringList, tone: stringField, trustSignals: stringList }),
      goals: section({ vision: longStringField, sixToTwelveMonthGoal: longStringField, primaryGoal: longStringField, primaryLeadObjective: longStringField }),
    } },
    confidence: { type: ["object", "null"], additionalProperties: false, properties: {} },
    missingAreas: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 } },
    suggestedQuestions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false,
      required: ["id", "dnaPath", "question", "reason", "required", "answerType", "options"], properties: {
        id: { type: "string", pattern: "^[a-z0-9-]{1,64}$" }, dnaPath: { type: "string", enum: BUSINESS_INTAKE_QUESTION_PATHS }, question: { type: "string", maxLength: 240 },
        reason: { type: "string", maxLength: 120 }, required: { type: "boolean" }, answerType: { type: "string", enum: ["text", "textarea", "choice", "choice-or-text"] },
        options: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string", maxLength: 80 }, value: { type: "string", maxLength: 80 } } } },
      } } },
    understandingSummary: { type: "string", maxLength: 800 },
    buildPlanSummary: { type: "array", maxItems: 6, items: { type: "string", maxLength: 240 } },
  },
} as const;

function inspectResponse(value: unknown) {
  const data = value && typeof value === "object" ? value as {
    status?: unknown; incomplete_details?: { reason?: unknown }; output_text?: unknown;
    output?: { type?: unknown; content?: { type?: unknown; text?: unknown }[] }[];
  } : {};
  const contentItemTypes: string[] = [];
  const outputTextParts: string[] = [];
  let refused = false;
  for (const output of data.output ?? []) {
    const outputType = typeof output.type === "string" ? output.type : "unknown";
    if (!Array.isArray(output.content)) continue;
    for (const item of output.content) {
      const contentType = typeof item.type === "string" ? item.type : "unknown";
      contentItemTypes.push(`${outputType}:${contentType}`);
      if (outputType !== "message") continue;
      if (contentType === "refusal") refused = true;
      if (contentType === "output_text" && typeof item.text === "string") outputTextParts.push(item.text);
    }
  }
  const text = typeof data.output_text === "string" ? data.output_text : outputTextParts.length ? outputTextParts.join("") : null;
  const trimmed = text?.trim() ?? "";
  const diagnostics: BusinessIntakeResponseDiagnostics = {
    responseStatus: typeof data.status === "string" ? data.status : null,
    incompleteReason: typeof data.incomplete_details?.reason === "string" ? data.incomplete_details.reason : null,
    contentItemTypes: [...new Set(contentItemTypes)].slice(0, 12),
    extractedTextLength: text?.length ?? 0,
    beginsWithJsonObject: trimmed.startsWith("{"),
    endsWithJsonObject: trimmed.endsWith("}"),
  };
  return { text, refused, diagnostics };
}

function omitNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null).map(([key, item]) => [key, omitNulls(item)]));
}

export async function requestBusinessIntakeAnalysis(input: BusinessIntakeAnalysisInput, options: { apiKey: string; fetcher?: typeof fetch }): Promise<{ analysis: BusinessIntakeAnalysis; inputTokens?: number; outputTokens?: number }> {
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ model: BUSINESS_INTAKE_MODEL, reasoning: { effort: "low" }, max_output_tokens: BUSINESS_INTAKE_MAX_OUTPUT_TOKENS,
        input: [{ role: "developer", content: "Understand the business using only supplied evidence. Never invent facts. Existing saved DNA is explicit customer data and must not be contradicted. Ask only important unanswered questions, normally 3-8. Keep every field concise and use short summaries. Use simple language matching preferredLanguage. Return no hidden reasoning." }, { role: "user", content: JSON.stringify(input) }],
        text: { format: { type: "json_schema", name: "business_intake_analysis", strict: true, schema: BUSINESS_INTAKE_JSON_SCHEMA } },
      }),
    });
  } catch (error) { throw new BusinessIntakeProviderError("provider_http", error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error"); }
  if (!response.ok) {
    let code = `http_${response.status}`;
    try {
      const body = await response.json() as { error?: { code?: unknown; type?: unknown } };
      const candidate = body?.error?.code ?? body?.error?.type;
      if (typeof candidate === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(candidate)) code = candidate;
    } catch { /* Provider error bodies are optional and never logged raw. */ }
    throw new BusinessIntakeProviderError("provider_http", code, response.status);
  }
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new BusinessIntakeProviderError("provider_parse", "invalid_response_json", response.status); }
  const inspected = inspectResponse(raw);
  if (inspected.diagnostics.responseStatus === "incomplete") {
    const reason = inspected.diagnostics.incompleteReason ?? "unknown";
    throw new BusinessIntakeProviderError("provider_parse", `incomplete_${reason}`, response.status, [], inspected.diagnostics);
  }
  if (inspected.diagnostics.responseStatus === "failed") throw new BusinessIntakeProviderError("provider_parse", "response_failed", response.status, [], inspected.diagnostics);
  if (inspected.refused) throw new BusinessIntakeProviderError("provider_parse", "refusal", response.status, [], inspected.diagnostics);
  const text = inspected.text;
  if (!text) {
    throw new BusinessIntakeProviderError("provider_parse", "missing_output_text", response.status, [], inspected.diagnostics);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new BusinessIntakeProviderError("provider_parse", "invalid_output_json", response.status, [], inspected.diagnostics); }
  const normalized = omitNulls(parsed);
  const analysis = validateBusinessIntakeAnalysis(normalized);
  if (!analysis) throw new BusinessIntakeProviderError("schema_validation", "runtime_validation_failed", response.status, businessIntakeAnalysisIssuePaths(normalized), inspected.diagnostics);
  const usage = (raw as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return { analysis, ...(Number.isSafeInteger(usage?.input_tokens) ? { inputTokens: usage!.input_tokens } : {}), ...(Number.isSafeInteger(usage?.output_tokens) ? { outputTokens: usage!.output_tokens } : {}) };
}
