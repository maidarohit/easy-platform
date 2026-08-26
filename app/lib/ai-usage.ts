import "server-only";

import { db } from "@/app/db";
import { aiUsage } from "@/app/db/schema";
import {
  calculateTokenComponentsCostUsd,
  calculateTokenCostUsd,
} from "@/app/lib/ai-cost";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { requirePaidModule } from "@/app/lib/paid-entitlements";
import { categoryForModule } from "@/app/lib/plan-config";
import { and, eq, sql } from "drizzle-orm";

type StartAiUsageInput = {
  userId: string;
  projectId: string;
  module: string;
  workflow: string;
  model?: string | null;
};

type CompleteAiUsageInput = {
  usageId: string;
  durationMs: number;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  usageComponents?: readonly AiUsageComponent[];
};

type FailAiUsageInput = {
  usageId: string;
  durationMs: number;
};

type EnrichAiUsageInput = {
  usageId: string;
  usageComponents: readonly AiUsageComponent[];
};

function componentUpdates(usageComponents: readonly AiUsageComponent[]) {
  const totalInputTokens = usageComponents.reduce(
    (total, component) => total + component.inputTokens,
    0
  );
  const totalOutputTokens = usageComponents.reduce(
    (total, component) => total + component.outputTokens,
    0
  );
  const models = new Set(usageComponents.map((component) => component.model));

  return {
    ...(Number.isSafeInteger(totalInputTokens) && { inputTokens: totalInputTokens }),
    ...(Number.isSafeInteger(totalOutputTokens) && { outputTokens: totalOutputTokens }),
    ...(models.size === 1 && { model: usageComponents[0].model }),
    estimatedCostUsd: calculateTokenComponentsCostUsd(usageComponents),
  };
}

export async function startAiUsage({
  userId,
  projectId,
  module,
  workflow,
  model,
}: StartAiUsageInput): Promise<string> {
  return db.transaction(async (transaction) => {
    const allowanceKey = `${userId}:${categoryForModule(module)}`;
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${allowanceKey}))`
    );

    const access = await requirePaidModule(userId, module);
    if (!access.ok) throw access.response;

    const [usage] = await transaction
      .insert(aiUsage)
      .values({
        userId,
        projectId,
        module,
        workflow,
        model: model ?? null,
        requestCount: 1,
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: "0",
        durationMs: null,
        status: "started",
      })
      .returning({ id: aiUsage.id });

    if (!usage) throw new Error("AI usage row was not created.");
    return usage.id;
  });
}

export async function claimIdempotentAiUsage(input: StartAiUsageInput): Promise<{ usageId: string; created: boolean; status: string }> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-usage:${input.userId}:${input.projectId}:${input.module}:${input.workflow}`}))`);
    const [existing] = await transaction.select({ id: aiUsage.id, status: aiUsage.status }).from(aiUsage).where(and(
      eq(aiUsage.userId, input.userId), eq(aiUsage.projectId, input.projectId), eq(aiUsage.module, input.module), eq(aiUsage.workflow, input.workflow),
    )).limit(1);
    if (existing) return { usageId: existing.id, created: false, status: existing.status };
    const access = await requirePaidModule(input.userId, input.module);
    if (!access.ok) throw access.response;
    const [usage] = await transaction.insert(aiUsage).values({
      userId: input.userId, projectId: input.projectId, module: input.module, workflow: input.workflow,
      model: input.model ?? null, requestCount: 1, inputTokens: null, outputTokens: null,
      estimatedCostUsd: "0", durationMs: null, status: "started",
    }).returning({ id: aiUsage.id, status: aiUsage.status });
    if (!usage) throw new Error("AI usage row was not created.");
    return { usageId: usage.id, created: true, status: usage.status };
  });
}

export async function completeAiUsage({
  usageId,
  durationMs,
  model,
  inputTokens,
  outputTokens,
  usageComponents,
}: CompleteAiUsageInput): Promise<void> {
  const updates: {
    status: "success";
    durationMs: number;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    estimatedCostUsd?: string;
  } = { status: "success", durationMs };

  if (model !== undefined) updates.model = model;
  if (inputTokens !== undefined) updates.inputTokens = inputTokens;
  if (outputTokens !== undefined) updates.outputTokens = outputTokens;

  if (usageComponents && usageComponents.length > 0) {
    Object.assign(updates, componentUpdates(usageComponents));
  } else if (
    typeof model === "string" &&
    typeof inputTokens === "number" &&
    typeof outputTokens === "number"
  ) {
    updates.estimatedCostUsd = calculateTokenCostUsd({
      model,
      inputTokens,
      outputTokens,
    });
  }

  await db
    .update(aiUsage)
    .set(updates)
    .where(eq(aiUsage.id, usageId));
}

export async function enrichAiUsage({
  usageId,
  usageComponents,
}: EnrichAiUsageInput): Promise<void> {
  if (usageComponents.length === 0) return;
  await db
    .update(aiUsage)
    .set(componentUpdates(usageComponents))
    .where(eq(aiUsage.id, usageId));
}

export async function failAiUsage({
  usageId,
  durationMs,
}: FailAiUsageInput): Promise<void> {
  await db
    .update(aiUsage)
    .set({ status: "failed", durationMs })
    .where(eq(aiUsage.id, usageId));
}
