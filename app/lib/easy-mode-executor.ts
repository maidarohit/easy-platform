import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import {
  easyModeRuns,
  easyModeTasks,
  projectMemory,
  projectOutputs,
  projects,
} from "@/app/db/schema";
import {
  BRANDING_AI_WORKFLOW,
  BrandingExecutionError,
  executeBrandingService,
  loadCanonicalBrandingInput,
} from "@/app/lib/branding-execution";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import {
  buildBrandingContext,
  getModuleAdapter,
  type NormalizedModuleOutput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import {
  bindEasyModeAttemptUsage,
  claimNextEasyModeTask,
  completeEasyModeAttempt,
  EasyModeAttemptError,
  failEasyModeAttemptBeforeDispatch,
  failEasyModeAttemptUncertain,
  markEasyModeAttemptDispatching,
  markEasyModeAttemptRunning,
  type ClaimedEasyModeTask,
} from "@/app/lib/easy-mode-task-attempts";

const ENABLED_MODULES = ["branding-context", "branding"] as const;

export type CustomerTaskStatus = "Waiting" | "In progress" | "Completed" | "Needs attention";
export type EasyModeCustomerProgress = Readonly<{
  runStatus: "In progress" | "Completed" | "Needs attention";
  tasks: readonly Readonly<{ label: string; status: CustomerTaskStatus }>[];
}>;

export type ExecuteNextResult = Readonly<{
  state: "completed" | "in_progress" | "needs_attention" | "not_available" | "disabled" | "not_found";
  message: string;
  progress?: EasyModeCustomerProgress;
}>;

type PersistedOutput = Readonly<{ id: string }>;
type ExecuteInput = Readonly<{ runId: string; userId: string }>;

type ExecutorDependencies = Readonly<{
  enabled: () => boolean;
  claim: typeof claimNextEasyModeTask;
  loadBrandingInput: typeof loadCanonicalBrandingInput;
  executeBranding: typeof executeBrandingService;
  startUsage: typeof startAiUsage;
  bindUsage: typeof bindEasyModeAttemptUsage;
  markDispatching: typeof markEasyModeAttemptDispatching;
  markRunning: typeof markEasyModeAttemptRunning;
  completeAttempt: typeof completeEasyModeAttempt;
  failBeforeDispatch: typeof failEasyModeAttemptBeforeDispatch;
  failUncertain: typeof failEasyModeAttemptUncertain;
  completeUsage: typeof completeAiUsage;
  failUsage: typeof failAiUsage;
  loadBrandingContext: typeof loadBrandingContextInput;
  persistBranding: typeof persistBrandingOutputAndMemory;
  persistContext: typeof persistBrandingContextOutput;
  progress: typeof getEasyModeCustomerProgress;
}>;

export function isEasyModeExecutionEnabled(): boolean {
  return process.env.EASY_MODE_EXECUTION_ENABLED?.trim().toLowerCase() === "true";
}

const defaultDependencies: ExecutorDependencies = {
  enabled: isEasyModeExecutionEnabled,
  claim: claimNextEasyModeTask,
  loadBrandingInput: loadCanonicalBrandingInput,
  executeBranding: executeBrandingService,
  startUsage: startAiUsage,
  bindUsage: bindEasyModeAttemptUsage,
  markDispatching: markEasyModeAttemptDispatching,
  markRunning: markEasyModeAttemptRunning,
  completeAttempt: completeEasyModeAttempt,
  failBeforeDispatch: failEasyModeAttemptBeforeDispatch,
  failUncertain: failEasyModeAttemptUncertain,
  completeUsage: completeAiUsage,
  failUsage: failAiUsage,
  loadBrandingContext: loadBrandingContextInput,
  persistBranding: persistBrandingOutputAndMemory,
  persistContext: persistBrandingContextOutput,
  progress: getEasyModeCustomerProgress,
};

const leaseInput = (claim: ClaimedEasyModeTask) => ({
  attemptId: claim.attemptId,
  userId: claim.context.userId,
  leaseToken: claim.leaseToken,
});

async function safeProgress(dependencies: ExecutorDependencies, runId: string, userId: string) {
  try {
    return await dependencies.progress(runId, userId);
  } catch {
    return undefined;
  }
}

export async function executeNextEasyModeTask(
  input: ExecuteInput,
  overrides: Partial<ExecutorDependencies> = {},
): Promise<ExecuteNextResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!dependencies.enabled()) {
    return { state: "disabled", message: "Business building is not available right now." };
  }

  let claim: ClaimedEasyModeTask | null;
  try {
    claim = await dependencies.claim({
      runId: input.runId,
      userId: input.userId,
      allowedModuleIds: ENABLED_MODULES,
    });
  } catch (error) {
    if (error instanceof EasyModeAttemptError && error.code === "MODULE_UNSUPPORTED") {
      return {
        state: "not_available",
        message: "The next step is not available in Easy Mode yet.",
        progress: await safeProgress(dependencies, input.runId, input.userId),
      };
    }
    if (error instanceof EasyModeAttemptError && error.code === "RUN_NOT_FOUND") {
      return { state: "not_found", message: "Business build not found." };
    }
    return {
      state: "needs_attention",
      message: "This business build needs attention before it can continue.",
      progress: await safeProgress(dependencies, input.runId, input.userId),
    };
  }

  if (!claim) {
    return {
      state: "in_progress",
      message: "This business build is already in progress or has no waiting steps.",
      progress: await safeProgress(dependencies, input.runId, input.userId),
    };
  }

  if (claim.moduleId === "branding-context") {
    return executeLocalBrandingContext(claim, dependencies);
  }
  return executeBrandingTask(claim, dependencies);
}

async function executeLocalBrandingContext(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
): Promise<ExecuteNextResult> {
  const lease = leaseInput(claim);
  try {
    const input = await dependencies.loadBrandingContext(claim.context);
    const output = buildBrandingContext(input);
    if (!output) throw new Error("Invalid local context.");
    const persisted = await dependencies.persistContext(claim.context, output);
    await dependencies.markRunning(lease);
    await dependencies.completeAttempt({ ...lease, projectOutputId: persisted.id });
    return {
      state: "completed",
      message: "Brand foundation completed.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  } catch {
    try {
      await dependencies.failBeforeDispatch({ ...lease, safeErrorCode: "TASK_FAILED" });
    } catch {
      // The lease/state may already have been finalized; never expose internals.
    }
    return {
      state: "needs_attention",
      message: "Brand foundation needs attention.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  }
}

async function executeBrandingTask(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
): Promise<ExecuteNextResult> {
  const lease = leaseInput(claim);
  const startedAt = Date.now();
  let usageId: string | null = null;
  let usageFinalized = false;
  let providerStarted = false;

  const finalizeFailedUsageOnce = async () => {
    if (!usageId || usageFinalized) return;
    usageFinalized = true;
    await dependencies.failUsage({ usageId, durationMs: Math.max(0, Date.now() - startedAt) });
  };

  try {
    const brandingInput = await dependencies.loadBrandingInput(claim.context);
    usageId = await dependencies.startUsage({
      userId: claim.context.userId,
      projectId: claim.context.projectId,
      module: "branding",
      workflow: BRANDING_AI_WORKFLOW,
      model: null,
    });
    await dependencies.bindUsage({ ...lease, usageId });
    await dependencies.markDispatching(lease);
    providerStarted = true;
    const result = await dependencies.executeBranding({ context: claim.context, input: brandingInput });
    await dependencies.markRunning({
      ...lease,
      ...(result.providerExecutionId ? { providerExecutionId: result.providerExecutionId } : {}),
    });
    const persisted = await dependencies.persistBranding(claim.context, result.output);
    usageFinalized = true;
    await dependencies.completeUsage({
      usageId,
      durationMs: Math.max(0, Date.now() - startedAt),
      usageComponents: result.usageComponents,
    });
    await dependencies.completeAttempt({ ...lease, projectOutputId: persisted.id });
    return {
      state: "completed",
      message: "Brand identity completed.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  } catch (error) {
    try {
      await finalizeFailedUsageOnce();
    } catch {
      // Usage finalization is attempted once; do not overwrite or retry it here.
    }
    const uncertain = providerStarted && !(error instanceof BrandingExecutionError && error.failurePoint === "before_dispatch");
    try {
      if (uncertain) {
        await dependencies.failUncertain({ ...lease, safeErrorCode: "DELIVERY_UNCERTAIN" });
      } else {
        await dependencies.failBeforeDispatch({ ...lease, safeErrorCode: "PROVIDER_UNAVAILABLE" });
      }
    } catch {
      // Never leak lease or transition details.
    }
    return {
      state: "needs_attention",
      message: "Brand identity needs attention.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  }
}

async function insertProjectOutput(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: TrustedModuleExecutionContext,
  module: "branding" | "branding-context",
  output: NormalizedModuleOutput,
): Promise<PersistedOutput> {
  const result = JSON.stringify(output);
  const [created] = await transaction.insert(projectOutputs).values({
    projectId: context.projectId,
    userId: context.userId,
    module,
    result,
  }).returning({ id: projectOutputs.id });
  if (!created) throw new Error("Output persistence failed.");
  return created;
}

export async function persistBrandingOutputAndMemory(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter("branding")?.validateOutput?.(value);
  if (!output) throw new Error("Invalid branding output.");
  return db.transaction(async (transaction) => {
    const [project] = await transaction.select().from(projects).where(and(
      eq(projects.id, context.projectId), eq(projects.userId, context.userId),
    )).limit(1).for("update");
    if (!project) throw new Error("Project not found.");
    const persisted = await insertProjectOutput(transaction, context, "branding", output);
    const brandName = String(output.brandName);
    const tagline = String(output.tagline);
    const memoryValues = {
      businessName: brandName,
      brandStyle: String(output.brandStyleGuide),
      brandVoice: String(output.brandVoice),
      brandColors: String(output.colorPalette),
      typography: String(output.typography),
      additionalContext: `Brand positioning: ${tagline}`,
      updatedAt: new Date(),
    };
    const [existingMemory] = await transaction.select({ id: projectMemory.id }).from(projectMemory).where(and(
      eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
    )).limit(1);
    if (existingMemory) {
      await transaction.update(projectMemory).set(memoryValues).where(eq(projectMemory.id, existingMemory.id));
    } else {
      await transaction.insert(projectMemory).values({
        projectId: context.projectId,
        userId: context.userId,
        industry: project.industry,
        businessDescription: project.originalBrief || project.brandDescription,
        targetAudience: project.targetAudience,
        ...memoryValues,
      });
    }
    return persisted;
  });
}

export async function loadBrandingContextInput(context: TrustedModuleExecutionContext) {
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, context.projectId), eq(projects.userId, context.userId),
  )).limit(1);
  if (!project) throw new Error("Project not found.");
  const [memory] = await db.select().from(projectMemory).where(and(
    eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
  )).limit(1);
  const [storedBranding] = await db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
    eq(projectOutputs.projectId, context.projectId), eq(projectOutputs.userId, context.userId),
    eq(projectOutputs.module, "branding"),
  )).orderBy(desc(projectOutputs.createdAt)).limit(1);
  let brandingOutput: unknown = null;
  if (storedBranding) {
    try {
      brandingOutput = getModuleAdapter("branding")?.validateOutput?.(JSON.parse(storedBranding.result)) ?? null;
    } catch {
      brandingOutput = null;
    }
  }
  return { project, memory: memory ?? null, brandingOutput };
}

export async function persistBrandingContextOutput(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter("branding-context")?.validateOutput?.(value);
  if (!output) throw new Error("Invalid branding context.");
  return db.transaction(async (transaction) => {
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, context.projectId), eq(projects.userId, context.userId),
    )).limit(1).for("update");
    if (!project) throw new Error("Project not found.");
    return insertProjectOutput(transaction, context, "branding-context", output);
  });
}

const CUSTOMER_LABELS: Readonly<Record<string, string>> = {
  "ai-manager": "Business plan",
  branding: "Brand identity",
  "branding-context": "Brand foundation",
  website: "Website",
  marketing: "Marketing",
  seo: "Search visibility",
  uiux: "Customer experience",
  sales: "Sales",
  analytics: "Business insights",
  content: "Content",
  logo: "Logo",
  image: "Images",
};

function customerTaskStatus(status: string): CustomerTaskStatus {
  if (status === "completed") return "Completed";
  if (status === "running") return "In progress";
  if (status === "failed") return "Needs attention";
  return "Waiting";
}

export async function getEasyModeCustomerProgress(runId: string, userId: string): Promise<EasyModeCustomerProgress> {
  const [run] = await db.select({ id: easyModeRuns.id, status: easyModeRuns.status }).from(easyModeRuns).where(and(
    eq(easyModeRuns.id, runId), eq(easyModeRuns.userId, userId),
  )).limit(1);
  if (!run) throw new Error("Run not found.");
  const tasks = await db.select({ moduleId: easyModeTasks.moduleId, status: easyModeTasks.status })
    .from(easyModeTasks).where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
  return Object.freeze({
    runStatus: run.status === "completed" ? "Completed" :
      run.status === "failed" || run.status === "partially_completed" ? "Needs attention" : "In progress",
    tasks: tasks.map((task) => Object.freeze({
      label: CUSTOMER_LABELS[task.moduleId] ?? "Business step",
      status: customerTaskStatus(task.status),
    })),
  });
}
