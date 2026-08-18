import "server-only";

import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";

export const N8N_EXECUTION_ID_HEADER = "x-easy-n8n-execution-id";

const MAX_EXECUTION_ID_LENGTH = 128;
const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_WORKFLOW_NAME_LENGTH = 128;

type ExecutionLookupResult =
  | { state: "ready"; component: AiUsageComponent }
  | { state: "retry" }
  | { state: "rejected" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function parseN8nExecutionId(headers: Headers): string | null {
  const value = headers.get(N8N_EXECUTION_ID_HEADER)?.trim();

  if (
    !value ||
    value.length > MAX_EXECUTION_ID_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }

  return value;
}

function findTokenUsage(
  value: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (depth > 12 || value === null || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTokenUsage(item, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) return null;

  if (isRecord(value.tokenUsageEstimate)) {
    return value.tokenUsageEstimate;
  }

  for (const child of Object.values(value)) {
    const found = findTokenUsage(child, depth + 1);
    if (found) return found;
  }

  return null;
}

function findModel(value: unknown, depth = 0): string | null {
  if (depth > 12 || value === null || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findModel(item, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (!isRecord(value)) return null;

  for (const key of ["model", "modelName", "model_name"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const child of Object.values(value)) {
    const found = findModel(child, depth + 1);
    if (found) return found;
  }

  return null;
}

function isTokenCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

export function extractOpenAiUsageComponent(
  execution: unknown,
  expectedWorkflowId: string,
  modelNodeName: string
): ExecutionLookupResult {
  if (
    !isRecord(execution) ||
    execution.workflowId !== expectedWorkflowId
  ) {
    return { state: "rejected" };
  }

  const status = execution.status;

  if (
    status === "running" ||
    status === "waiting" ||
    !execution.finished
  ) {
    return { state: "retry" };
  }

  if (status !== "success") {
    return { state: "rejected" };
  }

  const data = execution.data;
  const resultData = isRecord(data) ? data.resultData : null;
  const runData = isRecord(resultData) ? resultData.runData : null;
  const nodeData = isRecord(runData) ? runData[modelNodeName] : null;

  if (!nodeData) {
    return { state: "rejected" };
  }

  const usage = findTokenUsage(nodeData);
  const model = findModel(nodeData);

  if (!usage || !model) {
    return { state: "rejected" };
  }

  const inputTokens = usage.promptTokens;
  const outputTokens = usage.completionTokens;

  if (
    !isTokenCount(inputTokens) ||
    !isTokenCount(outputTokens)
  ) {
    return { state: "rejected" };
  }

  return {
    state: "ready",
    component: {
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
    },
  };
}

function workflowToEnvPrefix(workflow: string): string {
  const normalized = workflow.trim();

  if (
    !normalized ||
    normalized.length > MAX_WORKFLOW_NAME_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(normalized)
  ) {
    throw new Error("Invalid n8n workflow name.");
  }

  return normalized
    .replace(/-/g, "_")
    .toUpperCase();
}

function getConfig(workflow: string) {
  const baseUrl =
    process.env.N8N_API_BASE_URL?.trim().replace(/\/$/, "");

  const apiKey =
    process.env.N8N_API_KEY?.trim();

  const prefix = workflowToEnvPrefix(workflow);

  const workflowId =
    process.env[`N8N_${prefix}_WORKFLOW_ID`]?.trim();

  const modelNodeName =
    process.env[`N8N_${prefix}_MODEL_NODE_NAME`]?.trim();

  if (
    !baseUrl ||
    !apiKey ||
    !workflowId ||
    !modelNodeName
  ) {
    throw new Error(
      `n8n execution reconciliation is not configured for ${workflow}.`
    );
  }

  const url = new URL(baseUrl);

  if (url.protocol !== "https:") {
    throw new Error("n8n API base URL must use HTTPS.");
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ""),
    apiKey,
    workflowId,
    modelNodeName,
  };
}

async function readBoundedJson(
  response: Response
): Promise<unknown> {
  const declaredLength = Number(
    response.headers.get("content-length")
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_BYTES
  ) {
    throw new Error(
      "n8n execution response exceeded the size limit."
    );
  }

  if (!response.body) {
    throw new Error("n8n execution response was empty.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    size += value.byteLength;

    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();

      throw new Error(
        "n8n execution response exceeded the size limit."
      );
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(size);

  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  );
}

export async function fetchN8nExecutionUsage(
  executionId: string,
  workflow = "content-ai"
): Promise<ExecutionLookupResult> {
  if (
    !parseN8nExecutionId(
      new Headers([
        [N8N_EXECUTION_ID_HEADER, executionId],
      ])
    )
  ) {
    return { state: "rejected" };
  }

  const config = getConfig(workflow);

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const url = new URL(
      `/api/v1/executions/${encodeURIComponent(executionId)}`,
      `${config.baseUrl}/`
    );

    url.searchParams.set("includeData", "true");

    const response = await fetch(url, {
      headers: {
        "X-N8N-API-KEY": config.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (
      response.status === 404 ||
      response.status === 409 ||
      response.status === 429
    ) {
      return { state: "retry" };
    }

    if (!response.ok) {
      return { state: "rejected" };
    }

    const execution = await readBoundedJson(response);

    return extractOpenAiUsageComponent(
      execution,
      config.workflowId,
      config.modelNodeName
    );
  } finally {
    clearTimeout(timeout);
  }
}