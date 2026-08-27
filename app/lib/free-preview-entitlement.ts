import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns } from "@/app/db/schema";
import { preflightEasyModePlanQuota } from "@/app/lib/easy-mode-quota-preflight";
import type { EasyModeModule } from "@/app/lib/easy-mode-plans";
import { getUserSubscription } from "@/app/lib/subscriptions";

export function mayUseFreePreviewBuild(input: { paidAllowed: boolean; denialReason?: string; existingBuilds: number }) {
  return !input.paidAllowed && ["PAID_SUBSCRIPTION_REQUIRED", "PAID_FEATURE_UNAVAILABLE"].includes(input.denialReason ?? "") && input.existingBuilds === 0;
}

export function freePreviewBuildsEnabled(value = process.env.FREE_PREVIEW_BUILDS_ENABLED) {
  return value?.trim().toLowerCase() !== "false";
}

export async function preflightFreePreviewBusinessBuild(userId: string, plan: readonly EasyModeModule[]) {
  const paid = await preflightEasyModePlanQuota(userId, plan);
  if (paid.ok || !freePreviewBuildsEnabled()) return paid;
  const subscription = await getUserSubscription(userId);
  if (subscription?.status === "active") return paid;
  const [existing] = await db.select({ total: count() }).from(easyModeRuns).where(and(eq(easyModeRuns.userId, userId), eq(easyModeRuns.goalId, "build_everything")));
  return mayUseFreePreviewBuild({ paidAllowed: false, denialReason: paid.allowance.reason, existingBuilds: Number(existing?.total ?? 0) })
    ? { ok: true as const, requirements: [], freePreviewBuild: true as const }
    : paid;
}
