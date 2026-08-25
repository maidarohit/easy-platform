import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/app/db";
import { aiManagerJobs, easyModeRuns, easyModeTaskAttempts, easyModeTasks, projectMemory, projectOutputs, projects } from "@/app/db/schema";
import { getModuleAdapter, type ModuleExecutionInput, type TrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { deriveEasyModeRunStatus } from "@/app/lib/easy-mode-task-attempts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { SpecialistExecutionError } from "@/app/lib/specialist-execution";

export const AI_MANAGER_WORKFLOW = "ai-manager";

function callbackBaseUrl() {
  const value = process.env.AI_MANAGER_CALLBACK_BASE_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new SpecialistExecutionError("before_dispatch", 503);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SpecialistExecutionError("before_dispatch", 503);
  return url.toString().replace(/\/+$/, "");
}

export async function loadCanonicalAiManagerInput(context: TrustedModuleExecutionContext): Promise<ModuleExecutionInput> {
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, context.projectId), eq(projects.userId, context.userId),
  )).limit(1);
  if (!project) throw new SpecialistExecutionError("before_dispatch", 404);
  const [memory] = await db.select().from(projectMemory).where(and(
    eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
  )).limit(1);
  const candidate = {
    companyName: memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim(),
    businessDescription: memory?.businessDescription?.trim() || project.brandDescription?.trim() || project.originalBrief?.trim() || "Business growth plan",
    industry: memory?.industry?.trim() || project.industry?.trim() || "Business services",
    businessGoal: project.goal?.trim() || "Build and improve the business",
  };
  const input = getModuleAdapter("ai-manager")?.validateInput(candidate);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  return input;
}

export async function startEasyModeAiManagerJob(options: Readonly<{
  context: TrustedModuleExecutionContext;
  input: ModuleExecutionInput;
  usageId: string;
  fetcher?: typeof fetch;
  webhookConfig?: Readonly<{ url: string; headers: Readonly<Record<string, string>> }>;
}>) {
  const webhook = options.webhookConfig ?? getN8nWebhookConfig("N8N_AI_MANAGER_WEBHOOK_URL");
  if (!webhook) throw new SpecialistExecutionError("before_dispatch", 503);
  const [memory] = await db.select().from(projectMemory).where(and(
    eq(projectMemory.projectId, options.context.projectId), eq(projectMemory.userId, options.context.userId),
  )).limit(1);
  const [job] = await db.insert(aiManagerJobs).values({
    userId: options.context.userId, projectId: options.context.projectId,
    usageId: options.usageId, status: "pending",
  }).returning({ id: aiManagerJobs.id });
  if (!job) throw new SpecialistExecutionError("before_dispatch", 500);
  const payload = {
    ...options.input,
    projectId: options.context.projectId,
    userId: options.context.userId,
    analyticsContext: null,
    projectMemory: memory ?? null,
    jobId: job.id,
    callbackUrl: `${callbackBaseUrl()}/api/ai-manager/jobs/${encodeURIComponent(job.id)}`,
  };
  try {
    const response = await (options.fetcher ?? fetch)(webhook.url, {
      method: "POST", headers: webhook.headers, body: JSON.stringify(payload),
      cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("dispatch failed");
  } catch {
    await db.update(aiManagerJobs).set({ status: "failed", error: "Failed to start AI Manager job.", updatedAt: new Date() })
      .where(and(eq(aiManagerJobs.id, job.id), eq(aiManagerJobs.status, "pending")));
    throw new SpecialistExecutionError("uncertain");
  }
  await db.update(aiManagerJobs).set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(aiManagerJobs.id, job.id), eq(aiManagerJobs.status, "pending")));
  return Object.freeze({ jobId: job.id });
}

export async function syncEasyModeAiManagerTask(jobId: string) {
  return db.transaction(async (transaction) => {
    const [job] = await transaction.select().from(aiManagerJobs).where(eq(aiManagerJobs.id, jobId)).limit(1).for("update");
    if (!job?.usageId || !job.projectId || !["completed", "failed"].includes(job.status)) return;
    const [attempt] = await transaction.select().from(easyModeTaskAttempts).where(and(
      eq(easyModeTaskAttempts.usageId, job.usageId), eq(easyModeTaskAttempts.userId, job.userId),
      eq(easyModeTaskAttempts.projectId, job.projectId),
    )).limit(1).for("update");
    if (!attempt || ["completed", "failed_before_dispatch", "failed_uncertain"].includes(attempt.status)) return;
    const now = new Date();
    let outputId: string | null = null;
    if (job.status === "completed") {
      let raw: unknown;
      try { raw = job.result ? JSON.parse(job.result) : null; } catch { raw = null; }
      const output = getModuleAdapter("ai-manager")?.validateOutput?.(raw);
      if (!output) throw new Error("Invalid AI Manager output.");
      const [created] = await transaction.insert(projectOutputs).values({
        projectId: job.projectId, userId: job.userId, module: "ai-manager", result: JSON.stringify(output),
      }).returning({ id: projectOutputs.id });
      if (!created) throw new Error("AI Manager output persistence failed.");
      outputId = created.id;
      const summary = String(output.overview).slice(0, 1_000);
      const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
        .from(projectMemory).where(and(eq(projectMemory.projectId, job.projectId), eq(projectMemory.userId, job.userId))).limit(1);
      const additionalContext = [memory?.additionalContext?.trim().slice(-1_000), `AI Manager: ${summary}`].filter(Boolean).join("\n");
      if (memory) await transaction.update(projectMemory).set({ additionalContext, updatedAt: now }).where(eq(projectMemory.id, memory.id));
      else await transaction.insert(projectMemory).values({ projectId: job.projectId, userId: job.userId, additionalContext });
    }
    const taskStatus = job.status === "completed" ? "completed" : "failed";
    await transaction.update(easyModeTaskAttempts).set({
      status: job.status === "completed" ? "completed" : "failed_uncertain",
      finishedAt: now, safeErrorCode: job.status === "completed" ? null : "TASK_FAILED",
    }).where(and(eq(easyModeTaskAttempts.id, attempt.id), inArray(easyModeTaskAttempts.status, ["dispatching", "running"])));
    await transaction.update(easyModeTasks).set({
      status: taskStatus, projectOutputId: outputId,
      completedAt: job.status === "completed" ? now : null,
      failedAt: job.status === "failed" ? now : null,
      safeErrorCode: job.status === "failed" ? "TASK_FAILED" : null,
    }).where(eq(easyModeTasks.id, attempt.taskId));
    const statuses = await transaction.select({ status: easyModeTasks.status }).from(easyModeTasks).where(eq(easyModeTasks.runId, attempt.runId));
    const runStatus = deriveEasyModeRunStatus(statuses.map((item) => item.status));
    await transaction.update(easyModeRuns).set({
      status: runStatus,
      completedAt: runStatus === "completed" ? now : null,
      failedAt: runStatus === "failed" || runStatus === "partially_completed" ? now : null,
    }).where(and(eq(easyModeRuns.id, attempt.runId), eq(easyModeRuns.userId, job.userId)));
  });
}
