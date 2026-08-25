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
  CONTENT_AI_WORKFLOW,
  executeContentService,
  loadCanonicalContentInput,
} from "@/app/lib/content-execution";
import {
  AI_MANAGER_WORKFLOW,
  loadCanonicalAiManagerInput,
  startEasyModeAiManagerJob,
} from "@/app/lib/easy-mode-ai-manager";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import {
  buildBrandingContext,
  getModuleAdapter,
  type ModuleExecutionInput,
  type NormalizedModuleOutput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import {
  executeLogoService,
  loadCanonicalLogoInput,
  LOGO_AI_WORKFLOW,
} from "@/app/lib/logo-execution";
import {
  SpecialistExecutionError,
  type SpecialistExecutionResult,
} from "@/app/lib/specialist-execution";
import {
  executeTextSpecialistService,
  getTextSpecialistConfig,
  loadCanonicalTextSpecialistInput,
  TEXT_SPECIALIST_MODULES,
  type TextSpecialistModule,
} from "@/app/lib/text-specialist-execution";
import {
  bindEasyModeAttemptUsage,
  claimNextEasyModeTask,
  completeEasyModeAttempt,
  EasyModeAttemptError,
  failEasyModeAttemptBeforeDispatch,
  failEasyModeAttemptUncertain,
  markEasyModeAttemptDispatching,
  markEasyModeAttemptRunning,
  prepareEasyModeTaskRetry,
  reconcileUncertainEasyModeAttempt,
  type ClaimedEasyModeTask,
} from "@/app/lib/easy-mode-task-attempts";
import { loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";

const ENABLED_MODULES = ["ai-manager", "branding-context", "branding", "logo", "content", ...TEXT_SPECIALIST_MODULES] as const;

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

type InternalExecuteResult = ExecuteNextResult & Readonly<{
  retryableAttemptId?: string;
  retryableTaskId?: string;
  uncertainAttemptId?: string;
}>;

type PersistedOutput = Readonly<{ id: string }>;
type ExecuteInput = Readonly<{ runId: string; userId: string }>;
const MAX_AUTOMATIC_STEPS = 16;

type ExecutorDependencies = Readonly<{
  enabled: () => boolean;
  claim: typeof claimNextEasyModeTask;
  loadBrandingInput: typeof loadCanonicalBrandingInput;
  executeBranding: typeof executeBrandingService;
  loadLogoInput: typeof loadCanonicalLogoInput;
  executeLogo: typeof executeLogoService;
  loadContentInput: typeof loadCanonicalContentInput;
  executeContent: typeof executeContentService;
  loadAiManagerInput: typeof loadCanonicalAiManagerInput;
  startAiManagerJob: typeof startEasyModeAiManagerJob;
  loadTextInput: typeof loadCanonicalTextSpecialistInput;
  executeText: typeof executeTextSpecialistService;
  startUsage: typeof startAiUsage;
  bindUsage: typeof bindEasyModeAttemptUsage;
  markDispatching: typeof markEasyModeAttemptDispatching;
  markRunning: typeof markEasyModeAttemptRunning;
  completeAttempt: typeof completeEasyModeAttempt;
  failBeforeDispatch: typeof failEasyModeAttemptBeforeDispatch;
  failUncertain: typeof failEasyModeAttemptUncertain;
  prepareRetry: typeof prepareEasyModeTaskRetry;
  reconcileUncertain: typeof reconcileUncertainEasyModeAttempt;
  completeUsage: typeof completeAiUsage;
  failUsage: typeof failAiUsage;
  loadBrandingContext: typeof loadBrandingContextInput;
  persistBranding: typeof persistBrandingOutputAndMemory;
  persistLogo: typeof persistLogoOutputAndMemory;
  persistContent: typeof persistContentOutputAndMemory;
  persistText: typeof persistTextSpecialistOutputAndMemory;
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
  loadLogoInput: loadCanonicalLogoInput,
  executeLogo: executeLogoService,
  loadContentInput: loadCanonicalContentInput,
  executeContent: executeContentService,
  loadAiManagerInput: loadCanonicalAiManagerInput,
  startAiManagerJob: startEasyModeAiManagerJob,
  loadTextInput: loadCanonicalTextSpecialistInput,
  executeText: executeTextSpecialistService,
  startUsage: startAiUsage,
  bindUsage: bindEasyModeAttemptUsage,
  markDispatching: markEasyModeAttemptDispatching,
  markRunning: markEasyModeAttemptRunning,
  completeAttempt: completeEasyModeAttempt,
  failBeforeDispatch: failEasyModeAttemptBeforeDispatch,
  failUncertain: failEasyModeAttemptUncertain,
  prepareRetry: prepareEasyModeTaskRetry,
  reconcileUncertain: reconcileUncertainEasyModeAttempt,
  completeUsage: completeAiUsage,
  failUsage: failAiUsage,
  loadBrandingContext: loadBrandingContextInput,
  persistBranding: persistBrandingOutputAndMemory,
  persistLogo: persistLogoOutputAndMemory,
  persistContent: persistContentOutputAndMemory,
  persistText: persistTextSpecialistOutputAndMemory,
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
): Promise<InternalExecuteResult> {
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
  if (claim.moduleId === "ai-manager") return executeAiManagerTask(claim, dependencies);
  if (claim.moduleId === "branding") return executeBrandingTask(claim, dependencies);
  if (claim.moduleId === "logo") {
    return executeAdditionalSpecialistTask(claim, dependencies, {
      module: "logo", workflow: LOGO_AI_WORKFLOW, label: "Logo",
      loadInput: dependencies.loadLogoInput,
      execute: dependencies.executeLogo,
      persist: dependencies.persistLogo,
    });
  }
  if (claim.moduleId === "content") {
    return executeAdditionalSpecialistTask(claim, dependencies, {
      module: "content", workflow: CONTENT_AI_WORKFLOW, label: "Content",
      loadInput: dependencies.loadContentInput,
      execute: dependencies.executeContent,
      persist: dependencies.persistContent,
    });
  }
  const specialistModule = claim.moduleId as TextSpecialistModule;
  const config = getTextSpecialistConfig(specialistModule);
  return executeAdditionalSpecialistTask(claim, dependencies, {
    module: specialistModule, workflow: config.workflow, label: config.label,
    loadInput: (context) => dependencies.loadTextInput(context, specialistModule),
    execute: (options) => dependencies.executeText({ ...options, module: specialistModule }),
    persist: (context, value) => dependencies.persistText(context, specialistModule, value),
  });
}

export async function executeEasyModeRun(
  input: ExecuteInput,
  overrides: Partial<ExecutorDependencies> = {},
): Promise<ExecuteNextResult> {
  const internallyRetriedTasks = new Set<string>();
  for (let step = 0; step < MAX_AUTOMATIC_STEPS; step += 1) {
    const result = await executeNextEasyModeTask(input, overrides);
    const dependencies = { ...defaultDependencies, ...overrides };
    if (result.state === "needs_attention" && result.retryableAttemptId && result.retryableTaskId &&
        !internallyRetriedTasks.has(result.retryableTaskId)) {
      try {
        await dependencies.prepareRetry({ attemptId: result.retryableAttemptId, userId: input.userId });
        internallyRetriedTasks.add(result.retryableTaskId);
        continue;
      } catch {
        return { state: "needs_attention", message: "We could not complete your business build. Please contact support.", progress: result.progress };
      }
    }
    if (result.state === "needs_attention" && result.uncertainAttemptId) {
      try {
        const reconciliation = await dependencies.reconcileUncertain({
          attemptId: result.uncertainAttemptId,
          userId: input.userId,
        });
        if (reconciliation.state === "completed") continue;
      } catch {}
      return { state: "needs_attention", message: "We could not complete your business build. Please contact support.", progress: result.progress };
    }
    if (result.state !== "completed" || result.progress?.runStatus === "Completed") {
      return { state: result.state, message: result.message, progress: result.progress };
    }
  }
  return {
    state: "needs_attention",
    message: "This business build needs attention before it can continue.",
  };
}

async function executeAiManagerTask(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
): Promise<InternalExecuteResult> {
  const lease = leaseInput(claim);
  const startedAt = Date.now();
  let usageId: string | null = null;
  let dispatched = false;
  try {
    const moduleInput = await dependencies.loadAiManagerInput(claim.context);
    usageId = await dependencies.startUsage({
      userId: claim.context.userId, projectId: claim.context.projectId,
      module: "ai-manager", workflow: AI_MANAGER_WORKFLOW, model: null,
    });
    await dependencies.bindUsage({ ...lease, usageId });
    await dependencies.markDispatching(lease);
    const job = await dependencies.startAiManagerJob({ context: claim.context, input: moduleInput, usageId });
    dispatched = true;
    try {
      await dependencies.markRunning({ ...lease, providerExecutionId: job.jobId });
    } catch {
      // The callback is durably linked by usageId and can safely finish a dispatching attempt.
    }
    return {
      state: "in_progress",
      message: "Business plan is being prepared.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  } catch (error) {
    const uncertain = dispatched ||
      (error instanceof SpecialistExecutionError && error.failurePoint === "uncertain");
    if (usageId) {
      try { await dependencies.failUsage({ usageId, durationMs: Math.max(0, Date.now() - startedAt) }); } catch {}
    }
    try {
      if (uncertain) await dependencies.failUncertain({ ...lease, safeErrorCode: "DELIVERY_UNCERTAIN" });
      else await dependencies.failBeforeDispatch({ ...lease, safeErrorCode: "PROVIDER_UNAVAILABLE" });
    } catch {}
    return {
      state: "needs_attention",
      message: "Business plan needs attention.",
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
      ...(!usageId && !uncertain ? { retryableAttemptId: claim.attemptId, retryableTaskId: claim.taskId } : {}),
      ...(uncertain ? { uncertainAttemptId: claim.attemptId } : {}),
    };
  }
}

async function executeLocalBrandingContext(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
): Promise<InternalExecuteResult> {
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
      retryableAttemptId: claim.attemptId,
      retryableTaskId: claim.taskId,
    };
  }
}

async function executeBrandingTask(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
): Promise<InternalExecuteResult> {
  const lease = leaseInput(claim);
  const startedAt = Date.now();
  let usageId: string | null = null;
  let usageFinalized = false;
  let providerStarted = false;
  let persistedOutputId: string | null = null;

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
    persistedOutputId = persisted.id;
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
        await dependencies.failUncertain({
          ...lease,
          safeErrorCode: "DELIVERY_UNCERTAIN",
          ...(persistedOutputId ? { projectOutputId: persistedOutputId } : {}),
        });
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
      ...(!usageId && !uncertain ? { retryableAttemptId: claim.attemptId, retryableTaskId: claim.taskId } : {}),
      ...(uncertain ? { uncertainAttemptId: claim.attemptId } : {}),
    };
  }
}

type AdditionalSpecialistConfig = Readonly<{
  module: "logo" | "content" | TextSpecialistModule;
  workflow: string;
  label: string;
  loadInput: (context: TrustedModuleExecutionContext) => Promise<ModuleExecutionInput>;
  execute: (options: Readonly<{
    context: TrustedModuleExecutionContext;
    input?: unknown;
  }>) => Promise<SpecialistExecutionResult>;
  persist: (context: TrustedModuleExecutionContext, value: unknown) => Promise<PersistedOutput>;
}>;

async function executeAdditionalSpecialistTask(
  claim: ClaimedEasyModeTask,
  dependencies: ExecutorDependencies,
  config: AdditionalSpecialistConfig,
): Promise<InternalExecuteResult> {
  const lease = leaseInput(claim);
  const startedAt = Date.now();
  let usageId: string | null = null;
  let usageFinalized = false;
  let providerStarted = false;
  let persistedOutputId: string | null = null;
  const failUsageOnce = async () => {
    if (!usageId || usageFinalized) return;
    usageFinalized = true;
    await dependencies.failUsage({ usageId, durationMs: Math.max(0, Date.now() - startedAt) });
  };
  try {
    const moduleInput = await config.loadInput(claim.context);
    usageId = await dependencies.startUsage({
      userId: claim.context.userId,
      projectId: claim.context.projectId,
      module: config.module,
      workflow: config.workflow,
      model: null,
    });
    await dependencies.bindUsage({ ...lease, usageId });
    await dependencies.markDispatching(lease);
    providerStarted = true;
    const result = await config.execute({ context: claim.context, input: moduleInput });
    await dependencies.markRunning({
      ...lease,
      ...(result.providerExecutionId ? { providerExecutionId: result.providerExecutionId } : {}),
    });
    const persisted = await config.persist(claim.context, result.output);
    persistedOutputId = persisted.id;
    usageFinalized = true;
    await dependencies.completeUsage({
      usageId,
      durationMs: Math.max(0, Date.now() - startedAt),
      usageComponents: result.usageComponents,
    });
    await dependencies.completeAttempt({ ...lease, projectOutputId: persisted.id });
    return {
      state: "completed",
      message: `${config.label} completed.`,
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
    };
  } catch (error) {
    try {
      await failUsageOnce();
    } catch {
      // Usage failure finalization is attempted once.
    }
    const uncertain = providerStarted &&
      !(error instanceof SpecialistExecutionError && error.failurePoint === "before_dispatch");
    try {
      if (uncertain) {
        await dependencies.failUncertain({
          ...lease,
          safeErrorCode: "DELIVERY_UNCERTAIN",
          ...(persistedOutputId ? { projectOutputId: persistedOutputId } : {}),
        });
      } else {
        await dependencies.failBeforeDispatch({ ...lease, safeErrorCode: "PROVIDER_UNAVAILABLE" });
      }
    } catch {
      // Never expose lease or transition details.
    }
    return {
      state: "needs_attention",
      message: `${config.label} needs attention.`,
      progress: await safeProgress(dependencies, claim.runId, claim.context.userId),
      ...(!usageId && !uncertain ? { retryableAttemptId: claim.attemptId, retryableTaskId: claim.taskId } : {}),
      ...(uncertain ? { uncertainAttemptId: claim.attemptId } : {}),
    };
  }
}

async function insertProjectOutput(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: TrustedModuleExecutionContext,
  module: "branding" | "branding-context" | "logo" | "content" | TextSpecialistModule,
  output: NormalizedModuleOutput,
): Promise<PersistedOutput> {
  const result = JSON.stringify(output);
  const [created] = await transaction.insert(projectOutputs).values({
    projectId: context.projectId,
    userId: context.userId,
    module,
    result,
    approvedAt: null,
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

function appendMemorySummary(current: string | null, summary: string) {
  const prior = current?.trim().slice(-1_000);
  return [prior, summary.trim().slice(0, 1_000)].filter(Boolean).join("\n");
}

async function persistAdditionalSpecialistOutput(
  context: TrustedModuleExecutionContext,
  module: "logo" | "content",
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter(module)?.validateOutput?.(value);
  if (!output) throw new Error("Invalid specialist output.");
  return db.transaction(async (transaction) => {
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, context.projectId), eq(projects.userId, context.userId),
    )).limit(1).for("update");
    if (!project) throw new Error("Project not found.");
    const persisted = await insertProjectOutput(transaction, context, module, output);
    const [memory] = await transaction.select({
      id: projectMemory.id,
      additionalContext: projectMemory.additionalContext,
    }).from(projectMemory).where(and(
      eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
    )).limit(1);
    const summary = module === "logo"
      ? `Logo concept: ${String(output.concept)}`
      : `Latest content: ${String(output.content).slice(0, 500)}`;
    const additionalContext = appendMemorySummary(memory?.additionalContext ?? null, summary);
    if (memory) {
      await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() })
        .where(eq(projectMemory.id, memory.id));
    } else {
      await transaction.insert(projectMemory).values({
        projectId: context.projectId,
        userId: context.userId,
        additionalContext,
      });
    }
    return persisted;
  });
}

export async function persistTextSpecialistOutputAndMemory(
  context: TrustedModuleExecutionContext,
  module: TextSpecialistModule,
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter(module)?.validateOutput?.(value);
  if (!output) throw new Error("Invalid specialist output.");
  return db.transaction(async (transaction) => {
    const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, context.projectId), eq(projects.userId, context.userId),
    )).limit(1).for("update");
    if (!project) throw new Error("Project not found.");
    const persisted = await insertProjectOutput(transaction, context, module, output);
    const summaryField: Readonly<Record<TextSpecialistModule, string>> = {
      website: "websiteOverview", marketing: "marketingStrategy", seo: "seoAudit",
      uiux: "uiuxStrategy", sales: "executiveSummary", analytics: "executiveSummary",
    };
    const summaryValue = output[summaryField[module]];
    if (typeof summaryValue !== "string") throw new Error("Invalid specialist summary.");
    const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
      .from(projectMemory).where(and(
        eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
      )).limit(1);
    const additionalContext = appendMemorySummary(memory?.additionalContext ?? null,
      `${getTextSpecialistConfig(module).label}: ${summaryValue.slice(0, 750)}`);
    if (memory) {
      await transaction.update(projectMemory).set({ additionalContext, updatedAt: new Date() })
        .where(eq(projectMemory.id, memory.id));
    } else {
      await transaction.insert(projectMemory).values({
        projectId: context.projectId, userId: context.userId, additionalContext,
      });
    }
    return persisted;
  });
}

export function persistLogoOutputAndMemory(context: TrustedModuleExecutionContext, value: unknown) {
  return persistAdditionalSpecialistOutput(context, "logo", value);
}

export function persistContentOutputAndMemory(context: TrustedModuleExecutionContext, value: unknown) {
  return persistAdditionalSpecialistOutput(context, "content", value);
}

export async function loadBrandingContextInput(context: TrustedModuleExecutionContext) {
  const [ownedContext, brandingRows] = await Promise.all([
    loadOwnedProjectContext(context),
    db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, context.projectId), eq(projectOutputs.userId, context.userId),
      eq(projectOutputs.module, "branding"),
    )).orderBy(desc(projectOutputs.createdAt)).limit(1),
  ]);
  if (!ownedContext) throw new Error("Project not found.");
  const { project, memory } = ownedContext;
  const [storedBranding] = brandingRows;
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
