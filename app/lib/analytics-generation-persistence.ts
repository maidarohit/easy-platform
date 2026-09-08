import "server-only";

import { db } from "@/app/db";
import { aiUsage, projectOutputs, projects } from "@/app/db/schema";
import { calculateTokenComponentsCostUsd } from "@/app/lib/ai-cost";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { and, desc, eq, sql } from "drizzle-orm";

export async function persistCompletedAnalyticsGeneration(input: {
  usageId: string; userId: string; projectId: string; result: Record<string, unknown>;
  durationMs: number; usageComponents?: readonly AiUsageComponent[];
}) {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`analytics-output:${input.userId}:${input.projectId}`}))`);
    const [owned] = await transaction.select({ id: projects.id }).from(projects).where(and(eq(projects.id, input.projectId), eq(projects.userId, input.userId))).limit(1);
    if (!owned) throw new Error("Owned project not found.");
    const [existing] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, input.projectId), eq(projectOutputs.userId, input.userId), eq(projectOutputs.module, "analytics"),
    )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)).limit(1);
    const result = JSON.stringify(input.result);
    const [output] = existing
      ? await transaction.update(projectOutputs).set({ result, approvedAt: null, updatedAt: new Date() }).where(and(eq(projectOutputs.id, existing.id), eq(projectOutputs.userId, input.userId), eq(projectOutputs.projectId, input.projectId))).returning()
      : await transaction.insert(projectOutputs).values({ projectId: input.projectId, userId: input.userId, module: "analytics", result }).returning();
    if (!output) throw new Error("Analytics output was not persisted.");
    const components = input.usageComponents?.length ? input.usageComponents : null;
    const models = new Set(components?.map((item) => item.model) ?? []);
    const [usage] = await transaction.update(aiUsage).set({
      status: "success", durationMs: input.durationMs,
      ...(components ? { inputTokens: components.reduce((sum, item) => sum + item.inputTokens, 0), outputTokens: components.reduce((sum, item) => sum + item.outputTokens, 0), estimatedCostUsd: calculateTokenComponentsCostUsd(components) } : {}),
      ...(components && models.size === 1 ? { model: components[0].model } : {}),
    }).where(and(eq(aiUsage.id, input.usageId), eq(aiUsage.userId, input.userId), eq(aiUsage.projectId, input.projectId), eq(aiUsage.module, "analytics"), eq(aiUsage.status, "started"))).returning({ id: aiUsage.id });
    if (!usage) throw new Error("Analytics usage could not be completed.");
    return output;
  });
}
