import "server-only";

import { db } from "@/app/db";
import { aiUsage } from "@/app/db/schema";
import { desc, eq, sql } from "drizzle-orm";

const asNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export async function getAiUsageCostReport() {
  const grouped = await db
    .select({
      module: aiUsage.module,
      successfulRuns: sql<number>`count(*) filter (where ${aiUsage.status} = 'success')`,
      failedRuns: sql<number>`count(*) filter (where ${aiUsage.status} = 'failed')`,
      totalInputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
      totalCostUsd: sql<string>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
      averageCostUsdPerSuccessfulRun: sql<string>`coalesce(avg(${aiUsage.estimatedCostUsd}) filter (where ${aiUsage.status} = 'success'), 0)`,
      maximumCostUsdPerSuccessfulRun: sql<string>`coalesce(max(${aiUsage.estimatedCostUsd}) filter (where ${aiUsage.status} = 'success'), 0)`,
      averageDurationMs: sql<number>`coalesce(avg(${aiUsage.durationMs}), 0)`,
    })
    .from(aiUsage)
    .groupBy(aiUsage.module)
    .orderBy(aiUsage.module);

  const modules = grouped.map((row) => ({
    module: row.module,
    successfulRuns: asNumber(row.successfulRuns),
    failedRuns: asNumber(row.failedRuns),
    totalInputTokens: asNumber(row.totalInputTokens),
    totalOutputTokens: asNumber(row.totalOutputTokens),
    totalCostUsd: asNumber(row.totalCostUsd),
    averageCostUsdPerSuccessfulRun: asNumber(
      row.averageCostUsdPerSuccessfulRun
    ),
    maximumCostUsdPerSuccessfulRun: asNumber(
      row.maximumCostUsdPerSuccessfulRun
    ),
    averageDurationMs: asNumber(row.averageDurationMs),
  }));

  const [overallRow] = await db
    .select({
      successfulRuns: sql<number>`count(*) filter (where ${aiUsage.status} = 'success')`,
      failedRuns: sql<number>`count(*) filter (where ${aiUsage.status} = 'failed')`,
      totalInputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`,
      totalCostUsd: sql<string>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
      averageCostUsdPerSuccessfulRun: sql<string>`coalesce(avg(${aiUsage.estimatedCostUsd}) filter (where ${aiUsage.status} = 'success'), 0)`,
      maximumCostUsdPerSuccessfulRun: sql<string>`coalesce(max(${aiUsage.estimatedCostUsd}) filter (where ${aiUsage.status} = 'success'), 0)`,
      averageDurationMs: sql<number>`coalesce(avg(${aiUsage.durationMs}), 0)`,
    })
    .from(aiUsage);

  const recentRuns = await db
    .select({
      module: aiUsage.module,
      workflow: aiUsage.workflow,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      estimatedCostUsd: aiUsage.estimatedCostUsd,
      durationMs: aiUsage.durationMs,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(eq(aiUsage.status, "success"))
    .orderBy(desc(aiUsage.createdAt))
    .limit(50);

  const overall = {
    successfulRuns: asNumber(overallRow?.successfulRuns),
    failedRuns: asNumber(overallRow?.failedRuns),
    totalInputTokens: asNumber(overallRow?.totalInputTokens),
    totalOutputTokens: asNumber(overallRow?.totalOutputTokens),
    totalCostUsd: asNumber(overallRow?.totalCostUsd),
    averageCostUsdPerSuccessfulRun: asNumber(
      overallRow?.averageCostUsdPerSuccessfulRun
    ),
    maximumCostUsdPerSuccessfulRun: asNumber(
      overallRow?.maximumCostUsdPerSuccessfulRun
    ),
    averageDurationMs: asNumber(overallRow?.averageDurationMs),
  };

  return {
    generatedAt: new Date().toISOString(),
    modules,
    overall,
    recentSuccessfulRuns: recentRuns.map((row) => ({
      ...row,
      estimatedCostUsd: asNumber(row.estimatedCostUsd),
    })),
  };
}
