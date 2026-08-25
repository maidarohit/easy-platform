import "server-only";

import { getModuleAdapter } from "@/app/lib/easy-mode-execution-contracts";
import type { EasyModeModule } from "@/app/lib/easy-mode-plans";
import { allowanceError, checkUsageAllowance } from "@/app/lib/paid-entitlements";
import type { UsageCategory } from "@/app/lib/plan-config";

type Allowance = Awaited<ReturnType<typeof checkUsageAllowance>>;
type AllowanceChecker = (userId: string, category: UsageCategory) => Promise<Allowance>;

export type EasyModeQuotaRequirement = Readonly<{
  category: UsageCategory;
  taskCount: number;
}>;

export function calculateEasyModeQuotaRequirements(
  plan: readonly EasyModeModule[],
): readonly EasyModeQuotaRequirement[] {
  const counts = new Map<UsageCategory, number>();
  for (const moduleId of plan) {
    const adapter = getModuleAdapter(moduleId);
    if (!adapter?.usageCategory || adapter.executionSupport === "local-only" || adapter.executionSupport === "unsupported") continue;
    counts.set(adapter.usageCategory, (counts.get(adapter.usageCategory) ?? 0) + 1);
  }
  return [...counts].map(([category, taskCount]) => Object.freeze({ category, taskCount }));
}

export async function preflightEasyModePlanQuota(
  userId: string,
  plan: readonly EasyModeModule[],
  checkAllowance: AllowanceChecker = checkUsageAllowance,
) {
  const requirements = calculateEasyModeQuotaRequirements(plan);
  for (const requirement of requirements) {
    const allowance = await checkAllowance(userId, requirement.category);
    if (!allowance.ok) return { ok: false as const, allowance, requirement };
    if (allowance.used + requirement.taskCount > allowance.limit) {
      return {
        ok: false as const,
        allowance: {
          ok: false as const,
          reason: "PLAN_LIMIT_REACHED" as const,
          category: requirement.category,
          used: allowance.used,
          limit: allowance.limit,
        },
        requirement,
      };
    }
  }
  return { ok: true as const, requirements };
}

export function easyModeQuotaError(result: Exclude<Awaited<ReturnType<typeof preflightEasyModePlanQuota>>, { ok: true }>) {
  if (result.allowance.reason !== "PLAN_LIMIT_REACHED") return allowanceError(result.allowance);
  return Response.json({
    error: "You do not have enough quota remaining to complete this build. Choose a smaller goal or try again when your quota resets.",
    code: "EASY_MODE_RUN_QUOTA_INSUFFICIENT",
  }, { status: 429 });
}
