import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projectMemory, projectOutputs, projects } from "@/app/db/schema";
import {
  getModuleAdapter,
  type NormalizedModuleOutput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { sanitizeUiuxOutput } from "@/app/lib/uiux-insight-safety";
import { loadOwnedUiuxContext } from "@/app/lib/uiux-business-context";
import { getTextSpecialistConfig, type TextSpecialistModule } from "@/app/lib/text-specialist-execution";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PersistedOutput = Readonly<{ id: string }>;

async function insertProjectOutput(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  module: "branding" | "logo" | "content" | "branding-context" | TextSpecialistModule,
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

function appendMemorySummary(current: string | null, summary: string) {
  const prior = current?.trim().slice(-1_000);
  return [prior, summary.trim().slice(0, 1_000)].filter(Boolean).join("\n");
}

export async function persistBrandingOutputAndMemoryInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter("branding")?.validateOutput?.(value);
  if (!output) throw new Error("Invalid branding output.");
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
}

async function persistAdditionalSpecialistOutputInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  module: "logo" | "content",
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter(module)?.validateOutput?.(value);
  if (!output) throw new Error("Invalid specialist output.");
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
}

export function persistLogoOutputAndMemoryInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return persistAdditionalSpecialistOutputInTransaction(transaction, context, "logo", value);
}

export function persistContentOutputAndMemoryInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return persistAdditionalSpecialistOutputInTransaction(transaction, context, "content", value);
}

export async function persistTextSpecialistOutputAndMemoryInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  module: TextSpecialistModule,
  value: unknown,
): Promise<PersistedOutput> {
  let output = getModuleAdapter(module)?.validateOutput?.(value);
  if (!output) throw new Error("Invalid specialist output.");
  if (module === "uiux") {
    const uiuxContext = await loadOwnedUiuxContext(context.userId, context.projectId);
    if (!uiuxContext) throw new Error("UI/UX context not found.");
    output = getModuleAdapter("uiux")?.validateOutput?.(sanitizeUiuxOutput(output, uiuxContext));
    if (!output) throw new Error("Invalid UI/UX output.");
  }
  const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, context.projectId), eq(projects.userId, context.userId),
  )).limit(1).for("update");
  if (!project) throw new Error("Project not found.");
  const persisted = await insertProjectOutput(transaction, context, module, output);
  const summaryField: Readonly<Record<TextSpecialistModule, string>> = {
    website: "websiteOverview",
    marketing: "marketingStrategy",
    seo: "seoAudit",
    uiux: "uiuxStrategy",
    sales: "executiveSummary",
    analytics: "executiveSummary",
  };
  const summaryValue = output[summaryField[module]];
  if (typeof summaryValue !== "string") throw new Error("Invalid specialist summary.");
  const [memory] = await transaction.select({ id: projectMemory.id, additionalContext: projectMemory.additionalContext })
    .from(projectMemory).where(and(
      eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
    )).limit(1);
  const additionalContext = appendMemorySummary(
    memory?.additionalContext ?? null,
    `${getTextSpecialistConfig(module).label}: ${summaryValue.slice(0, 750)}`,
  );
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
}

export async function persistBrandingContextOutputInTransaction(
  transaction: DbTransaction,
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  const output = getModuleAdapter("branding-context")?.validateOutput?.(value);
  if (!output) throw new Error("Invalid branding context.");
  const [project] = await transaction.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, context.projectId), eq(projects.userId, context.userId),
  )).limit(1).for("update");
  if (!project) throw new Error("Project not found.");
  return insertProjectOutput(transaction, context, "branding-context", output);
}

export function persistBrandingOutputAndMemory(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return db.transaction((transaction) => persistBrandingOutputAndMemoryInTransaction(transaction, context, value));
}

export function persistLogoOutputAndMemory(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return db.transaction((transaction) => persistLogoOutputAndMemoryInTransaction(transaction, context, value));
}

export function persistContentOutputAndMemory(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return db.transaction((transaction) => persistContentOutputAndMemoryInTransaction(transaction, context, value));
}

export function persistTextSpecialistOutputAndMemory(
  context: TrustedModuleExecutionContext,
  module: TextSpecialistModule,
  value: unknown,
): Promise<PersistedOutput> {
  return db.transaction((transaction) => persistTextSpecialistOutputAndMemoryInTransaction(transaction, context, module, value));
}

export function persistBrandingContextOutput(
  context: TrustedModuleExecutionContext,
  value: unknown,
): Promise<PersistedOutput> {
  return db.transaction((transaction) => persistBrandingContextOutputInTransaction(transaction, context, value));
}
