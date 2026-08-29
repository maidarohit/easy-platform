import "server-only";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, easyModeRuns, easyModeTaskAttempts, easyModeTasks, projectMemory, projectOutputs, projects } from "@/app/db/schema";
import { validateSalesOutput } from "@/app/lib/easy-mode-execution-contracts";
import { derivePersistedEasyModeRunStatus } from "@/app/lib/easy-mode-task-attempts";

export const SALES_347_PROJECT_ID = "c704e98b-4b6d-41d6-9ffe-fe7fb926f598";
export const SALES_347_RUN_ID = "a44f1366-6785-40b2-8aba-bd878b68b36e";
export const SALES_347_TASK_ID = "39813208-563c-4007-800b-003c8084f920";
export const SALES_347_USAGE_ID = "e7c2080d-fc06-4924-a116-d458c7bcd221";
export const SALES_347_EXECUTION_ID = "347";
const NORMAL_MODULES = ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"] as const;
const MAX_EXECUTION_BYTES = 2 * 1024 * 1024;

type RecordValue = Record<string, unknown>;
export type Sales347Execution = Readonly<{ output: Readonly<Record<string, string>>; durationMs: number | null }>;
export type Sales347Result = Readonly<{
  state: "validated" | "reconciled" | "already_reconciled";
  outputId: string | null;
  salesTaskStatus: "running" | "completed";
  runStatus: "running" | "completed";
}>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataValues(value: unknown, normalizedKey: string, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) metadataValues(item, normalizedKey, found);
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (key.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalizedKey && typeof item === "string") found.add(item);
      metadataValues(item, normalizedKey, found);
    }
  }
  return found;
}

function metadataMatchesWhenPresent(value: unknown, key: string, expected: string) {
  const values = metadataValues(value, key);
  return values.size === 0 || (values.size === 1 && values.has(expected));
}

function collectSalesOutputs(value: unknown, found = new Map<string, Readonly<Record<string, string>>>()) {
  const output = validateSalesOutput(value);
  if (output) found.set(JSON.stringify(output), output);
  if (Array.isArray(value)) {
    for (const item of value) collectSalesOutputs(item, found);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) collectSalesOutputs(item, found);
  }
  return found;
}

export function validateSales347Execution(execution: unknown, expectedWorkflowId: string): Sales347Execution | null {
  if (!isRecord(execution) || String(execution.id) !== SALES_347_EXECUTION_ID || execution.status !== "success" ||
      String(execution.workflowId) !== expectedWorkflowId) return null;
  if (!metadataMatchesWhenPresent(execution, "projectid", SALES_347_PROJECT_ID) ||
      !metadataMatchesWhenPresent(execution, "runid", SALES_347_RUN_ID) ||
      !metadataMatchesWhenPresent(execution, "taskid", SALES_347_TASK_ID) ||
      !metadataMatchesWhenPresent(execution, "usageid", SALES_347_USAGE_ID)) return null;
  const data = isRecord(execution.data) ? execution.data : null;
const resultData = data && isRecord(data.resultData) ? data.resultData : null;
const runData = resultData && isRecord(resultData.runData) ? resultData.runData : null;

const respondRuns =
  runData && Array.isArray(runData["Respond to Webhook"])
    ? runData["Respond to Webhook"]
    : [];

const lastRespondRun = respondRuns.at(-1);

const respondData =
  isRecord(lastRespondRun) && isRecord(lastRespondRun.data)
    ? lastRespondRun.data
    : null;

const main =
  respondData && Array.isArray(respondData.main)
    ? respondData.main
    : [];

const firstBranch = Array.isArray(main[0]) ? main[0] : [];

const finalItem =
  firstBranch.length === 1 && isRecord(firstBranch[0])
    ? firstBranch[0]
    : null;

const output =
  finalItem && "json" in finalItem
    ? validateSalesOutput(finalItem.json)
    : null;

if (!output) return null;
  const startedAt = typeof execution.startedAt === "string" ? Date.parse(execution.startedAt) : Number.NaN;
  const stoppedAt = typeof execution.stoppedAt === "string" ? Date.parse(execution.stoppedAt) : Number.NaN;
  const durationMs = Number.isFinite(startedAt) && Number.isFinite(stoppedAt) && stoppedAt >= startedAt
    ? stoppedAt - startedAt : null;
  return { output, durationMs };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("Execution 347 could not be verified.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_EXECUTION_BYTES) { await reader.cancel(); throw new Error("Execution 347 response is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function fetchAndValidateSales347Execution(fetcher: typeof fetch = fetch): Promise<Sales347Execution> {
  const baseUrl = process.env.N8N_API_BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.N8N_API_KEY?.trim();
  const workflowId = process.env.N8N_SALES_AI_WORKFLOW_ID?.trim();
  if (!baseUrl || !apiKey || !workflowId) throw new Error("Sales execution verification is not configured.");
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") throw new Error("Sales execution verification requires HTTPS.");
  const url = new URL(`/api/v1/executions/${SALES_347_EXECUTION_ID}`, `${base.toString().replace(/\/$/, "")}/`);
  url.searchParams.set("includeData", "true");
  const response = await fetcher(url, {
    method: "GET", cache: "no-store",
    headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const execution = validateSales347Execution(await readBoundedJson(response), workflowId);
  if (!execution) throw new Error("Execution 347 is not a valid successful Sales execution.");
  return execution;
}

async function reconcileSales347(execution: Sales347Execution, dryRun: boolean): Promise<Sales347Result> {
  return db.transaction(async (transaction) => {
    const [run] = await transaction.select().from(easyModeRuns).where(and(
      eq(easyModeRuns.id, SALES_347_RUN_ID), eq(easyModeRuns.projectId, SALES_347_PROJECT_ID),
    )).limit(1).for("update");
    if (!run) throw new Error("Fixed Sales run was not found.");
    const [project] = await transaction.select({ id: projects.id, userId: projects.userId }).from(projects).where(
      eq(projects.id, SALES_347_PROJECT_ID),
    ).limit(1).for("update");
    if (!project || project.userId !== run.userId) throw new Error("Fixed Sales project ownership changed.");
    const tasks = await transaction.select({
      id: easyModeTasks.id, moduleId: easyModeTasks.moduleId, position: easyModeTasks.position,
      status: easyModeTasks.status, projectOutputId: easyModeTasks.projectOutputId,
      outputModule: projectOutputs.module, outputProjectId: projectOutputs.projectId, outputUserId: projectOutputs.userId,
    }).from(easyModeTasks).leftJoin(projectOutputs, eq(projectOutputs.id, easyModeTasks.projectOutputId))
      .where(eq(easyModeTasks.runId, SALES_347_RUN_ID)).orderBy(asc(easyModeTasks.position)).for("update");
    if (tasks.length !== 7 || tasks.some((task, index) => task.position !== index || task.moduleId !== NORMAL_MODULES[index])) {
      throw new Error("Fixed run is not the normal seven-task build.");
    }
    const sales = tasks[6];
    const earlierValid = tasks.slice(0, 6).every((task) => task.status === "completed" && task.projectOutputId &&
      task.outputModule === task.moduleId && task.outputProjectId === SALES_347_PROJECT_ID && task.outputUserId === run.userId);
    if (!earlierValid) throw new Error("The first six persisted outputs are not complete and module-matched.");
    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
      eq(easyModeTaskAttempts.runId, SALES_347_RUN_ID), eq(easyModeTaskAttempts.taskId, SALES_347_TASK_ID),
      eq(easyModeTaskAttempts.projectId, SALES_347_PROJECT_ID),
    )).orderBy(desc(easyModeTaskAttempts.attemptNumber)).limit(1).for("update");
    const [usage] = await transaction.select().from(aiUsage).where(eq(aiUsage.id, SALES_347_USAGE_ID)).limit(1).for("update");
    if (!attempt || attempt.usageId !== SALES_347_USAGE_ID || attempt.userId !== run.userId ||
        !usage || usage.userId !== run.userId || usage.projectId !== SALES_347_PROJECT_ID || usage.module !== "sales") {
      throw new Error("Fixed Sales attempt or usage does not match.");
    }

    if (run.status === "completed" && sales.id === SALES_347_TASK_ID && sales.status === "completed" &&
        sales.projectOutputId && attempt.status === "completed" && attempt.providerExecutionId === SALES_347_EXECUTION_ID &&
        usage.status === "success") {
      const [existing] = await transaction.select().from(projectOutputs).where(and(
        eq(projectOutputs.id, sales.projectOutputId), eq(projectOutputs.projectId, SALES_347_PROJECT_ID),
        eq(projectOutputs.userId, run.userId), eq(projectOutputs.module, "sales"),
      )).limit(1);
      let parsed: unknown = null;
      try { parsed = JSON.parse(existing?.result ?? ""); } catch {}
      if (!existing || !validateSalesOutput(parsed)) throw new Error("Existing Sales reconciliation is inconsistent.");
      return { state: "already_reconciled", outputId: existing.id, salesTaskStatus: "completed", runStatus: "completed" };
    }

    if (run.status !== "running" || sales.id !== SALES_347_TASK_ID || sales.status !== "running" || sales.projectOutputId ||
        attempt.status !== "dispatching" || attempt.providerExecutionId !== null || usage.status !== "started") {
      throw new Error("Fixed Sales state is no longer safely reconcilable.");
    }
    const [existingSales] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, SALES_347_PROJECT_ID), eq(projectOutputs.userId, run.userId),
      eq(projectOutputs.module, "sales"), gte(projectOutputs.createdAt, run.createdAt),
    )).limit(1).for("update");
    if (existingSales) throw new Error("An unlinked Sales output already exists.");
    if (dryRun) return { state: "validated", outputId: null, salesTaskStatus: "running", runStatus: "running" };

    const [created] = await transaction.insert(projectOutputs).values({
      projectId: SALES_347_PROJECT_ID, userId: run.userId, module: "sales",
      result: JSON.stringify(execution.output), approvedAt: null,
    }).returning({ id: projectOutputs.id });
    if (!created) throw new Error("Sales output persistence failed.");
    const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
      .from(projectMemory).where(and(eq(projectMemory.projectId, SALES_347_PROJECT_ID), eq(projectMemory.userId, run.userId)))
      .limit(1).for("update");
    const additionalContext = [memory?.additionalContext?.trim().slice(-1_000),
      `Sales: ${execution.output.executiveSummary.slice(0, 750)}`].filter(Boolean).join("\n");
    if (memory) await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() }).where(eq(projectMemory.id, memory.id));
    else await transaction.insert(projectMemory).values({ projectId: SALES_347_PROJECT_ID, userId: run.userId, additionalContext });

    const now = new Date();
    const [completedUsage] = await transaction.update(aiUsage).set({
      status: "success", ...(execution.durationMs !== null ? { durationMs: execution.durationMs } : {}),
    }).where(and(eq(aiUsage.id, SALES_347_USAGE_ID), eq(aiUsage.status, "started"))).returning({ id: aiUsage.id });
    const [completedAttempt] = await transaction.update(easyModeTaskAttempts).set({
      status: "completed", providerExecutionId: SALES_347_EXECUTION_ID, finishedAt: now, safeErrorCode: null,
    }).where(and(eq(easyModeTaskAttempts.id, attempt.id), eq(easyModeTaskAttempts.status, "dispatching"),
      eq(easyModeTaskAttempts.usageId, SALES_347_USAGE_ID))).returning({ id: easyModeTaskAttempts.id });
    const [completedTask] = await transaction.update(easyModeTasks).set({
      status: "completed", projectOutputId: created.id, completedAt: now, failedAt: null, safeErrorCode: null,
    }).where(and(eq(easyModeTasks.id, SALES_347_TASK_ID), eq(easyModeTasks.status, "running")))
      .returning({ id: easyModeTasks.id });
    if (!completedUsage || !completedAttempt || !completedTask) throw new Error("Sales reconciliation raced with another change.");
    const completedTasks = tasks.map((task, index) => index === 6
      ? { status: "completed", projectOutputId: created.id } : { status: task.status, projectOutputId: task.projectOutputId });
    const runStatus = derivePersistedEasyModeRunStatus(completedTasks);
    if (runStatus !== "completed") throw new Error("Seven persisted outputs were not established.");
    const [completedRun] = await transaction.update(easyModeRuns).set({
      status: "completed", completedAt: now, failedAt: null,
    }).where(and(eq(easyModeRuns.id, SALES_347_RUN_ID), eq(easyModeRuns.status, "running")))
      .returning({ id: easyModeRuns.id });
    if (!completedRun) throw new Error("Sales run completion raced with another change.");
    return { state: "reconciled", outputId: created.id, salesTaskStatus: "completed", runStatus: "completed" };
  });
}

export const validateCurrentSales347 = (execution: Sales347Execution) => reconcileSales347(execution, true);
export const applySales347Reconciliation = (execution: Sales347Execution) => reconcileSales347(execution, false);
