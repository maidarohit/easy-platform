import "server-only";

import { db } from "@/app/db";
import { aiUsage, projectOutputs, projects } from "@/app/db/schema";
import { calculateTokenComponentsCostUsd } from "@/app/lib/ai-cost";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { and, desc, eq, sql } from "drizzle-orm";

export async function persistCompletedSeoGeneration(input: {
  usageId: string;
  userId: string;
  projectId: string;
  result: Record<string, unknown>;
  durationMs: number;
  usageComponents?: readonly AiUsageComponent[];
}) {
  const serialized = JSON.stringify(input.result);
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`seo-output:${input.userId}:${input.projectId}`}))`);
    const [ownedProject] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, input.projectId), eq(projects.userId, input.userId),
    )).limit(1);
    if (!ownedProject) throw new Error("Owned project not found.");

    const [existing] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, input.projectId), eq(projectOutputs.userId, input.userId), eq(projectOutputs.module, "seo"),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
    const now = new Date();
    const [output] = existing
      ? await transaction.update(projectOutputs).set({ result: serialized, approvedAt: null, updatedAt: now }).where(and(
          eq(projectOutputs.id, existing.id), eq(projectOutputs.projectId, input.projectId), eq(projectOutputs.userId, input.userId),
        )).returning()
      : await transaction.insert(projectOutputs).values({ projectId: input.projectId, userId: input.userId, module: "seo", result: serialized }).returning();
    if (!output) throw new Error("SEO output was not persisted.");

    const components = input.usageComponents?.length ? input.usageComponents : null;
    const inputTokens = components?.reduce((total, item) => total + item.inputTokens, 0);
    const outputTokens = components?.reduce((total, item) => total + item.outputTokens, 0);
    const models = new Set(components?.map((item) => item.model) ?? []);
    const [usage] = await transaction.update(aiUsage).set({
      status: "success",
      durationMs: input.durationMs,
      ...(components ? { inputTokens, outputTokens, estimatedCostUsd: calculateTokenComponentsCostUsd(components) } : {}),
      ...(components && models.size === 1 ? { model: components[0].model } : {}),
    }).where(and(
      eq(aiUsage.id, input.usageId), eq(aiUsage.userId, input.userId), eq(aiUsage.projectId, input.projectId),
      eq(aiUsage.module, "seo"), eq(aiUsage.status, "started"),
    )).returning({ id: aiUsage.id });
    if (!usage) throw new Error("SEO usage could not be completed.");
    return output;
  });
}
