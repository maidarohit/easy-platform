import "server-only";

import { validateBusinessIntakeAnalysis, type BusinessIntakeAnalysis, type BusinessIntakeAnalysisInput } from "@/app/lib/business-intake-analysis";

export const BUSINESS_INTAKE_MODEL = "gpt-5-mini";
const TIMEOUT_MS = 45_000;

export class BusinessIntakeProviderError extends Error {
  constructor() { super("BUSINESS_INTAKE_ANALYSIS_FAILED"); this.name = "BusinessIntakeProviderError"; }
}

const stringField = { type: ["string", "null"], maxLength: 4000 } as const;
const stringList = { type: ["array", "null"], maxItems: 50, items: { type: "string", maxLength: 500 } } as const;
const section = (properties: Record<string, unknown>) => ({ type: ["object", "null"], additionalProperties: false, required: Object.keys(properties), properties });

export const BUSINESS_INTAKE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["extractedDna", "confidence", "missingAreas", "suggestedQuestions", "understandingSummary", "buildPlanSummary"],
  properties: {
    extractedDna: { type: "object", additionalProperties: false, required: ["identity", "founderHistory", "location", "offer", "customers", "digitalPresence", "personality", "goals"], properties: {
      identity: section({ businessName: stringField, industry: stringField, subIndustry: stringField, businessStage: stringField }),
      founderHistory: section({ founderStory: stringField, whyStarted: stringField, businessAge: stringField, businessGeneration: stringField }),
      location: section({ city: stringField, region: stringField, country: stringField, serviceAreas: stringList }),
      offer: section({ products: stringList, services: stringList, strongestOffers: stringList, differentiators: stringList }),
      customers: section({ currentCustomers: stringField, desiredCustomers: stringField, targetAudience: stringField }),
      digitalPresence: section({ existingWebsite: stringField, websiteStatus: stringField, socialPresence: stringList, digitalProblems: stringList }),
      personality: section({ brandPersonality: stringList, tone: stringField, trustSignals: stringList }),
      goals: section({ vision: stringField, sixToTwelveMonthGoal: stringField, primaryGoal: stringField, primaryLeadObjective: stringField }),
    } },
    confidence: { type: ["object", "null"], additionalProperties: false, properties: {} },
    missingAreas: { type: "array", maxItems: 12, items: { type: "string", maxLength: 200 } },
    suggestedQuestions: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false,
      required: ["id", "dnaPath", "question", "reason", "required", "answerType", "options"], properties: {
        id: { type: "string", pattern: "^[a-z0-9-]{1,64}$" }, dnaPath: { type: "string" }, question: { type: "string", maxLength: 500 },
        reason: { type: "string", maxLength: 500 }, required: { type: "boolean" }, answerType: { type: "string", enum: ["text", "textarea", "choice", "choice-or-text"] },
        options: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["label", "value"], properties: { label: { type: "string", maxLength: 200 }, value: { type: "string", maxLength: 200 } } } },
      } } },
    understandingSummary: { type: "string", maxLength: 2000 },
    buildPlanSummary: { type: "array", maxItems: 8, items: { type: "string", maxLength: 500 } },
  },
} as const;

function outputText(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const data = value as { output?: { content?: { type?: string; text?: string }[] }[]; output_text?: string };
  if (typeof data.output_text === "string") return data.output_text;
  for (const output of data.output ?? []) for (const content of output.content ?? []) if (content.type === "output_text" && typeof content.text === "string") return content.text;
  return null;
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
      body: JSON.stringify({ model: BUSINESS_INTAKE_MODEL, reasoning: { effort: "low" }, max_output_tokens: 2200,
        input: [{ role: "developer", content: "Understand the business using only supplied evidence. Never invent facts. Existing saved DNA is explicit customer data and must not be contradicted. Ask only important unanswered questions, normally 3-8. Use simple language matching preferredLanguage. Return no hidden reasoning." }, { role: "user", content: JSON.stringify(input) }],
        text: { format: { type: "json_schema", name: "business_intake_analysis", strict: true, schema: BUSINESS_INTAKE_JSON_SCHEMA } },
      }),
    });
  } catch { throw new BusinessIntakeProviderError(); }
  if (!response.ok) throw new BusinessIntakeProviderError();
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new BusinessIntakeProviderError(); }
  const text = outputText(raw);
  if (!text) throw new BusinessIntakeProviderError();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new BusinessIntakeProviderError(); }
  const analysis = validateBusinessIntakeAnalysis(omitNulls(parsed));
  if (!analysis) throw new BusinessIntakeProviderError();
  const usage = (raw as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return { analysis, ...(Number.isSafeInteger(usage?.input_tokens) ? { inputTokens: usage!.input_tokens } : {}), ...(Number.isSafeInteger(usage?.output_tokens) ? { outputTokens: usage!.output_tokens } : {}) };
}
