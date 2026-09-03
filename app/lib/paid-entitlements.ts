import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, entitlementOverrides, projects } from "@/app/db/schema";
import {
  categoryForModule,
  PLAN_LIMITS,
  USAGE_CATEGORIES,
  type PaidPlan,
  type UsageCategory,
} from "@/app/lib/plan-config";
import { getUserSubscription } from "@/app/lib/subscriptions";

const ACCESS_CATEGORY = "__paid_access__";
const PRIVATE_BETA_CATEGORIES = new Set<UsageCategory>(["projects", "standardAiTasks", "aiManagerRuns", "imageGenerations", "videoGenerations", "presentationGenerations", "automationRuns", "assistantMessages"]);

function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function categorySwitch(category: UsageCategory): string | null {
  if (category === "imageGenerations") return "PAID_IMAGE_AI_ENABLED";
  if (category === "videoGenerations") return "PAID_VIDEO_AI_ENABLED";
  if (category === "aiManagerRuns") return "PAID_AI_MANAGER_ENABLED";
  if (category === "automationRuns") return "PAID_AUTOMATION_ENABLED";
  return null;
}

function isPrivateBetaUser(userId: string, category: UsageCategory): boolean {
  if (!PRIVATE_BETA_CATEGORIES.has(category)) return false;
  return new Set(
    [process.env.PRIVATE_BETA_UIDS, process.env.PRIVATE_BETA_UIDS_EXTRA, process.env.PRIVATE_BETA_UIDS_TEST]
      .flatMap((value) => (value ?? "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  ).has(userId);
}

export async function hasPaidProductAccess(userId: string) {
  if (isBossAdmin(userId) || isPrivateBetaUser(userId, "standardAiTasks")) return true;
  const subscription = await getUserSubscription(userId);
  if (!subscription || subscription.status !== "active") return false;
  const overrides = await db.select().from(entitlementOverrides).where(and(
    eq(entitlementOverrides.userId, userId), eq(entitlementOverrides.category, ACCESS_CATEGORY),
  ));
  return !overrides.some((item) => item.paidAccessDisabled);
}

export async function requirePaidProductAccess(userId: string) {
  return await hasPaidProductAccess(userId)
    ? { ok: true as const }
    : { ok: false as const, response: Response.json({ error: "An active subscription is required for this feature.", code: "PAID_SUBSCRIPTION_REQUIRED" }, { status: 403 }) };
}

export function isTestProjectLimitBypassUser(userId: string): boolean {
  return new Set(
    (process.env.PRIVATE_BETA_UIDS_TEST ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  ).has(userId);
}

export function projectCountAllowance(input: { userId: string; plan: PaidPlan; used: number; limit: number }) {
  if (isTestProjectLimitBypassUser(input.userId)) {
    return { ok: true as const, plan: input.plan, category: "projects" as const, used: input.used, limit: input.limit, testLimitBypass: true as const };
  }
  return input.used >= input.limit
    ? { ok: false as const, reason: "PLAN_LIMIT_REACHED" as const, category: "projects" as const, used: input.used, limit: input.limit }
    : { ok: true as const, plan: input.plan, category: "projects" as const, used: input.used, limit: input.limit };
}

export async function checkUsageAllowance(userId: string, category: UsageCategory) {
  const privateBetaUser = isBossAdmin(userId) || isPrivateBetaUser(userId, category);
  if (!privateBetaUser && !enabled("PAID_AI_GENERATION_ENABLED")) return { ok: false as const, reason: "PAID_FEATURE_UNAVAILABLE" as const };
  const switchName = categorySwitch(category);
  if (!privateBetaUser && switchName && !enabled(switchName)) return { ok: false as const, reason: "PAID_FEATURE_UNAVAILABLE" as const };

  const subscription = await getUserSubscription(userId);
  if (!privateBetaUser && (!subscription || subscription.status !== "active")) return { ok: false as const, reason: "PAID_SUBSCRIPTION_REQUIRED" as const };

  const overrides = await db.select().from(entitlementOverrides).where(and(
    eq(entitlementOverrides.userId, userId),
    inArray(entitlementOverrides.category, [ACCESS_CATEGORY, category])
  ));
  if (!privateBetaUser && overrides.some((item) => item.category === ACCESS_CATEGORY && item.paidAccessDisabled)) {
    return { ok: false as const, reason: "PAID_FEATURE_UNAVAILABLE" as const };
  }

  const plan = subscription?.status === "active" ? subscription.plan : "pro";
  const configuredLimit = PLAN_LIMITS[plan][category];
  const categoryOverride = overrides.find((item) => item.category === category);
  const limit = categoryOverride?.limit ?? configuredLimit;
  const periodStart = subscription?.status === "active"
    ? subscription.currentPeriodStart ?? subscription.createdAt
    : new Date(0);
  if (category === "projects") {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.userId, userId));
    const used = Number(row?.count ?? 0);
    return projectCountAllowance({ userId, plan, used, limit });
  }

  const modules = Object.entries({
    "ai-manager": "aiManagerRuns", image: "imageGenerations", video: "videoGenerations",
    presentation: "presentationGenerations", assistant: "assistantMessages",
    "automation-content": "automationRuns", "automation-email": "automationRuns",
    "automation-social": "automationRuns", "automation-workflow": "automationRuns",
    "automation-pipeline": "automationRuns",
  }).filter(([, mapped]) => mapped === category).map(([module]) => module);

  const conditions = [eq(aiUsage.userId, userId), gte(aiUsage.createdAt, periodStart)];
  if (category === "standardAiTasks") {
    conditions.push(sql`${aiUsage.module} NOT LIKE 'automation-%' AND ${aiUsage.module} NOT IN ('ai-manager','image','video','presentation','assistant')`);
  } else if (modules.length) {
    conditions.push(inArray(aiUsage.module, modules));
  }
  const [row] = await db.select({ count: sql<number>`coalesce(sum(${aiUsage.requestCount}), 0)` }).from(aiUsage).where(and(...conditions));
  const used = Number(row?.count ?? 0);
  return !privateBetaUser && used >= limit
    ? { ok: false as const, reason: "PLAN_LIMIT_REACHED" as const, category, used, limit }
    : { ok: true as const, plan, category, used, limit };
}

export function allowanceError(result: Exclude<Awaited<ReturnType<typeof checkUsageAllowance>>, { ok: true }>) {
  return Response.json({ error: result.reason, ...(result.reason === "PLAN_LIMIT_REACHED" && { category: result.category }) }, { status: result.reason === "PAID_SUBSCRIPTION_REQUIRED" ? 403 : 429 });
}

export async function requirePaidEntitlement(userId: string, category: UsageCategory) {
  const result = await checkUsageAllowance(userId, category);
  return result.ok ? { ok: true as const, entitlement: result } : { ok: false as const, response: allowanceError(result) };
}

export async function requirePaidModule(userId: string, module: string) {
  return requirePaidEntitlement(userId, categoryForModule(module));
}

export function isBossAdmin(uid: string): boolean {
  return new Set(
    [process.env.BOSS_ADMIN_UIDS, process.env.BOSS_ADMIN_UIDS_TEST]
      .flatMap((value) => (value ?? "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  ).has(uid);
}

export async function getCurrentUsageCounters(userId: string) {
  const results = await Promise.all(USAGE_CATEGORIES.map(async (category) => [category, await checkUsageAllowance(userId, category)] as const));
  return Object.fromEntries(results.map(([category, result]) => [category, "used" in result ? result.used : 0]));
}
