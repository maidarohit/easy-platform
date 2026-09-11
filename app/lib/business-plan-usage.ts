import "server-only";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  aiUsage,
  businessPublications,
  projects,
  publishedWebsites,
  usageNotifications,
} from "@/app/db/schema";
import {
  PLAN_LIMITS,
  categoryForModule,
  type PaidPlan,
  type UsageCategory,
} from "@/app/lib/plan-config";
import {
  resolveSubscriptionBillingDetails,
  type BillingCurrency,
  getUserSubscription,
} from "@/app/lib/subscriptions";

export const BUSINESS_USAGE_NOTIFICATION_THRESHOLDS = [50, 80, 100] as const;
export type BusinessUsageNotificationThreshold =
  (typeof BUSINESS_USAGE_NOTIFICATION_THRESHOLDS)[number];

export const BUSINESS_USAGE_PLANNING_EXCHANGE_RATE_INR_PER_USD = 90;

export const BUSINESS_PLAN_MARKET_LIMITS = {
  india: {
    websiteGenerations: 2,
    websiteEdits: 20,
    brandingGenerations: 5,
    seoGenerations: 10,
    marketingGenerations: 15,
    contentGenerations: 20,
    salesGenerations: 10,
    uiuxGenerations: 5,
    aiManagerRuns: 50,
    logoGenerations: 3,
    imageGenerations: 5,
    presentationGenerations: 2,
    videoGenerations: 1,
    projects: 1,
  },
  international: {
    websiteGenerations: 3,
    websiteEdits: 30,
    brandingGenerations: 8,
    seoGenerations: 15,
    marketingGenerations: 20,
    contentGenerations: 30,
    salesGenerations: 15,
    uiuxGenerations: 8,
    aiManagerRuns: 75,
    logoGenerations: 5,
    imageGenerations: 8,
    presentationGenerations: 3,
    videoGenerations: 2,
    projects: 1,
  },
} as const satisfies Record<
  "india" | "international",
  Pick<
    Record<UsageCategory, number>,
    | "websiteGenerations"
    | "websiteEdits"
    | "brandingGenerations"
    | "seoGenerations"
    | "marketingGenerations"
    | "contentGenerations"
    | "salesGenerations"
    | "uiuxGenerations"
    | "aiManagerRuns"
    | "logoGenerations"
    | "imageGenerations"
    | "presentationGenerations"
    | "videoGenerations"
    | "projects"
  >
>;

export const BUSINESS_PLAN_COST_POLICIES = {
  india: {
    currency: "INR",
    totalCogsTarget: 500,
    aiWarning: 300,
    aiSafetyCeiling: 350,
  },
  international: {
    currency: "USD",
    totalCogsTarget: 12.5,
    aiWarning: 7.5,
    aiSafetyCeiling: 8.75,
  },
} as const satisfies Record<
  "india" | "international",
  Readonly<{
    currency: BillingCurrency;
    totalCogsTarget: number;
    aiWarning: number;
    aiSafetyCeiling: number;
  }>
>;

export const BUSINESS_WORKSPACE_FEATURES = [
  { key: "activeBusiness", label: "Active business" },
  { key: "publishedWebsite", label: "Published website" },
] as const;

export const BUSINESS_CUSTOMER_AI_FEATURES = [
  { category: "websiteGenerations", key: "websiteAi", label: "Website AI", detail: "full generations" },
  { category: "websiteEdits", key: "websiteAiEdits", label: "Website AI", detail: "assisted edits" },
  { category: "brandingGenerations", key: "brandingAi", label: "Branding AI", detail: null },
  { category: "seoGenerations", key: "seoAi", label: "SEO AI", detail: null },
  { category: "marketingGenerations", key: "marketingAi", label: "Marketing AI", detail: null },
  { category: "contentGenerations", key: "contentAi", label: "Content AI", detail: null },
  { category: "salesGenerations", key: "salesAi", label: "Sales AI", detail: null },
  { category: "uiuxGenerations", key: "uiuxAi", label: "UI/UX AI", detail: null },
  { category: "aiManagerRuns", key: "aiManager", label: "AI Manager", detail: "requests" },
  { category: "logoGenerations", key: "logoAi", label: "Logo AI", detail: null },
  { category: "imageGenerations", key: "imageAi", label: "Image AI", detail: null },
  { category: "presentationGenerations", key: "presentationAi", label: "Presentation AI", detail: null },
  { category: "videoGenerations", key: "videoAi", label: "Video AI", detail: null },
] as const satisfies readonly {
  category: UsageCategory;
  key: string;
  label: string;
  detail: string | null;
}[];

type ActiveBusinessSubscription = Awaited<ReturnType<typeof getUserSubscription>> & {
  status: "active";
  plan: PaidPlan;
};

type ResolvedBusinessBilling = Readonly<{
  market: keyof typeof BUSINESS_PLAN_MARKET_LIMITS;
  currency: BillingCurrency;
  source: "stored_market" | "provider_plan_id" | "legacy_india_fallback";
  usedLegacyFallback: boolean;
}>;

type BillingPeriod = Readonly<{
  start: Date;
  end: Date | null;
}>;

type FeatureUsage = Readonly<{
  key: string;
  label: string;
  detail: string | null;
  category: UsageCategory;
  used: number;
  limit: number;
  remaining: number;
  percentageUsed: number;
}>;

type WorkspaceUsage = Readonly<{
  key: (typeof BUSINESS_WORKSPACE_FEATURES)[number]["key"];
  label: string;
  used: number;
  limit: number;
  remaining: number;
}>;

type NotificationRecord = Readonly<{
  id: string;
  category: UsageCategory;
  featureLabel: string;
  threshold: BusinessUsageNotificationThreshold;
  message: string;
  remaining: number;
  resetAt: Date | null;
  createdAt: Date;
}>;

type InternalCostSummary = Readonly<{
  billingMarket: keyof typeof BUSINESS_PLAN_MARKET_LIMITS;
  billingCurrency: BillingCurrency;
  totalCogsTarget: number;
  warningThreshold: number;
  safetyCeiling: number;
  measuredCostUsd: number;
  measuredCost: number;
  blocked: boolean;
  unavailableModules: readonly string[];
  periodStart: Date;
  resetAt: Date | null;
  usedLegacyFallback: boolean;
}>;

function asFiniteNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function activeBusinessSubscription(
  subscription: Awaited<ReturnType<typeof getUserSubscription>>,
): ActiveBusinessSubscription | null {
  if (!subscription || subscription.status !== "active") return null;
  return subscription.plan === "business" ? subscription as ActiveBusinessSubscription : null;
}

export function businessPlanMarket(
  subscription: Awaited<ReturnType<typeof getUserSubscription>> | null,
): ResolvedBusinessBilling | null {
  const resolved = resolveSubscriptionBillingDetails(subscription);
  if (!resolved) return null;
  return {
    market: resolved.market,
    currency: resolved.currency,
    source: resolved.source,
    usedLegacyFallback: resolved.usedLegacyFallback,
  };
}

export function businessPlanUsageLimit(input: {
  plan: PaidPlan;
  billingMarket: keyof typeof BUSINESS_PLAN_MARKET_LIMITS | null | undefined;
  category: UsageCategory;
}) {
  if (input.plan !== "business") return PLAN_LIMITS[input.plan][input.category];
  const market = input.billingMarket ?? "india";
  const variant = BUSINESS_PLAN_MARKET_LIMITS[market];
  return variant[input.category as keyof typeof variant] ?? PLAN_LIMITS.business[input.category];
}

export function businessPlanCostPolicy(
  billingMarket: keyof typeof BUSINESS_PLAN_MARKET_LIMITS | null | undefined,
) {
  return BUSINESS_PLAN_COST_POLICIES[billingMarket ?? "india"];
}

export function usagePercentage(used: number, limit: number) {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function usageRemaining(used: number, limit: number) {
  return Math.max(limit - used, 0);
}

export function usageThresholdsReached(
  used: number,
  limit: number,
): readonly BusinessUsageNotificationThreshold[] {
  if (limit <= 0) return [];
  const percent = (used / limit) * 100;
  return BUSINESS_USAGE_NOTIFICATION_THRESHOLDS.filter((threshold) => percent >= threshold);
}

export function missingUsageThresholds(input: {
  used: number;
  limit: number;
  existing: readonly BusinessUsageNotificationThreshold[];
}) {
  const existing = new Set<BusinessUsageNotificationThreshold>(input.existing);
  return usageThresholdsReached(input.used, input.limit).filter(
    (threshold) => !existing.has(threshold),
  );
}

export function usageNotificationMessage(input: {
  featureLabel: string;
  threshold: BusinessUsageNotificationThreshold;
  remaining: number;
  resetAt: Date | null;
}) {
  const resetDate = input.resetAt
    ? input.resetAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "your next billing reset";

  if (input.threshold === 50) {
    return `You've used 50% of your monthly ${input.featureLabel} allowance.`;
  }
  if (input.threshold === 80) {
    return `You've used 80% of your monthly ${input.featureLabel} allowance. ${input.remaining} remaining until ${resetDate}.`;
  }
  return `You've used your monthly ${input.featureLabel} allowance. Your other Buzypeezy tools remain available. This allowance resets on ${resetDate}.`;
}

export function summarizeMeasuredCost(input: {
  rows: readonly Readonly<{ module: string; totalCostUsd: number; successfulRuns: number }>[];
  billingMarket?: keyof typeof BUSINESS_PLAN_MARKET_LIMITS | null;
  exchangeRateInrPerUsd?: number;
}) {
  const exchangeRate = input.exchangeRateInrPerUsd ?? BUSINESS_USAGE_PLANNING_EXCHANGE_RATE_INR_PER_USD;
  const policy = businessPlanCostPolicy(input.billingMarket);
  const unavailableModules = input.rows
    .filter((row) => row.successfulRuns > 0 && row.totalCostUsd <= 0)
    .map((row) => row.module)
    .sort();
  const measuredCostUsd = input.rows.reduce(
    (total, row) => total + (row.totalCostUsd > 0 ? row.totalCostUsd : 0),
    0,
  );
  const measuredCost = policy.currency === "USD"
    ? Math.round(measuredCostUsd * 100) / 100
    : Math.round(measuredCostUsd * exchangeRate * 100) / 100;

  return {
    measuredCostUsd,
    measuredCost,
    blocked: measuredCost >= policy.aiSafetyCeiling,
    unavailableModules,
  };
}

function billingPeriod(subscription: ActiveBusinessSubscription): BillingPeriod {
  return {
    start: subscription.currentPeriodStart ?? subscription.createdAt,
    end: subscription.currentPeriodEnd ?? null,
  };
}

async function successfulUsageByModule(userId: string, periodStart: Date) {
  return db
    .select({
      module: aiUsage.module,
      used: sql<number>`coalesce(sum(${aiUsage.requestCount}), 0)`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.status, "success"),
        gte(aiUsage.createdAt, periodStart),
      ),
    )
    .groupBy(aiUsage.module);
}

function summarizeFeatureUsage(
  countsByCategory: ReadonlyMap<UsageCategory, number>,
  plan: PaidPlan,
  billingMarket: keyof typeof BUSINESS_PLAN_MARKET_LIMITS,
) {
  return BUSINESS_CUSTOMER_AI_FEATURES.map((feature) => {
    const limit = businessPlanUsageLimit({ plan, billingMarket, category: feature.category });
    const used = countsByCategory.get(feature.category) ?? 0;
    return {
      key: feature.key,
      label: feature.label,
      detail: feature.detail,
      category: feature.category,
      used,
      limit,
      remaining: usageRemaining(used, limit),
      percentageUsed: usagePercentage(used, limit),
    } satisfies FeatureUsage;
  });
}

async function ensureUsageNotifications(input: {
  userId: string;
  period: BillingPeriod;
  features: readonly FeatureUsage[];
}) {
  const existingRows = await db
    .select({
      id: usageNotifications.id,
      category: usageNotifications.category,
      threshold: usageNotifications.thresholdPercent,
      createdAt: usageNotifications.createdAt,
    })
    .from(usageNotifications)
    .where(
      and(
        eq(usageNotifications.userId, input.userId),
        eq(usageNotifications.billingPeriodStart, input.period.start),
        inArray(
          usageNotifications.category,
          BUSINESS_CUSTOMER_AI_FEATURES.map((feature) => feature.category),
        ),
      ),
    );

  const existingByCategory = new Map<UsageCategory, BusinessUsageNotificationThreshold[]>();
  for (const row of existingRows) {
    const thresholds = existingByCategory.get(row.category as UsageCategory) ?? [];
    thresholds.push(row.threshold as BusinessUsageNotificationThreshold);
    existingByCategory.set(row.category as UsageCategory, thresholds);
  }

  const missingRows = input.features.flatMap((feature) =>
    missingUsageThresholds({
      used: feature.used,
      limit: feature.limit,
      existing: existingByCategory.get(feature.category) ?? [],
    }).map((threshold) => ({
      userId: input.userId,
      category: feature.category,
      thresholdPercent: threshold,
      billingPeriodStart: input.period.start,
    })),
  );

  if (missingRows.length > 0) {
    await db.insert(usageNotifications).values(missingRows).onConflictDoNothing({
      target: [
        usageNotifications.userId,
        usageNotifications.category,
        usageNotifications.thresholdPercent,
        usageNotifications.billingPeriodStart,
      ],
    });
  }

  const rows = await db
    .select({
      id: usageNotifications.id,
      category: usageNotifications.category,
      threshold: usageNotifications.thresholdPercent,
      createdAt: usageNotifications.createdAt,
    })
    .from(usageNotifications)
    .where(
      and(
        eq(usageNotifications.userId, input.userId),
        eq(usageNotifications.billingPeriodStart, input.period.start),
        inArray(
          usageNotifications.category,
          BUSINESS_CUSTOMER_AI_FEATURES.map((feature) => feature.category),
        ),
      ),
    )
    .orderBy(sql`${usageNotifications.createdAt} desc`);

  const featuresByCategory = new Map(input.features.map((feature) => [feature.category, feature] as const));

  return rows.flatMap((row) => {
    const feature = featuresByCategory.get(row.category as UsageCategory);
    if (!feature) return [];
    return [{
      id: row.id,
      category: row.category as UsageCategory,
      featureLabel: feature.label,
      threshold: row.threshold as BusinessUsageNotificationThreshold,
      message: usageNotificationMessage({
        featureLabel: feature.label,
        threshold: row.threshold as BusinessUsageNotificationThreshold,
        remaining: feature.remaining,
        resetAt: input.period.end,
      }),
      remaining: feature.remaining,
      resetAt: input.period.end,
      createdAt: row.createdAt,
    } satisfies NotificationRecord];
  });
}

async function workspaceUsage(userId: string) {
  const [projectCountRow, publishedWebsiteRows, businessPublicationRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(publishedWebsites)
      .where(and(eq(publishedWebsites.ownerUid, userId), eq(publishedWebsites.status, "active"))),
    db.select({ count: sql<number>`count(*)` }).from(businessPublications)
      .where(and(eq(businessPublications.userId, userId), eq(businessPublications.status, "active"))),
  ]);

  const activeBusinessUsed = asFiniteNumber(projectCountRow[0]?.count);
  const publishedWebsiteUsed =
    asFiniteNumber(publishedWebsiteRows[0]?.count) + asFiniteNumber(businessPublicationRows[0]?.count);

  return [
    {
      key: "activeBusiness",
      label: "Active business",
      used: activeBusinessUsed,
      limit: 1,
      remaining: usageRemaining(activeBusinessUsed, 1),
    },
    {
      key: "publishedWebsite",
      label: "Published website",
      used: publishedWebsiteUsed,
      limit: 1,
      remaining: usageRemaining(publishedWebsiteUsed, 1),
    },
  ] satisfies readonly WorkspaceUsage[];
}

async function internalCostSummary(
  userId: string,
  period: BillingPeriod,
  billing: ResolvedBusinessBilling,
): Promise<InternalCostSummary> {
  const rows = await db
    .select({
      module: aiUsage.module,
      totalCostUsd: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)`,
      successfulRuns: sql<number>`count(*)`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.status, "success"),
        gte(aiUsage.createdAt, period.start),
      ),
    )
    .groupBy(aiUsage.module);

  const summary = summarizeMeasuredCost({
    billingMarket: billing.market,
    rows: rows.map((row) => ({
      module: row.module,
      totalCostUsd: asFiniteNumber(row.totalCostUsd),
      successfulRuns: asFiniteNumber(row.successfulRuns),
    })),
  });
  const policy = businessPlanCostPolicy(billing.market);

  return {
    billingMarket: billing.market,
    billingCurrency: billing.currency,
    totalCogsTarget: policy.totalCogsTarget,
    warningThreshold: policy.aiWarning,
    safetyCeiling: policy.aiSafetyCeiling,
    ...summary,
    periodStart: period.start,
    resetAt: period.end,
    usedLegacyFallback: billing.usedLegacyFallback,
  };
}

export async function getBusinessPlanUsageSnapshot(userId: string) {
  const subscription = activeBusinessSubscription(await getUserSubscription(userId));
  if (!subscription) return null;
  const billing = businessPlanMarket(subscription);
  if (!billing) return null;

  const period = billingPeriod(subscription);
  const [usageRows, workspace, cost] = await Promise.all([
    successfulUsageByModule(userId, period.start),
    workspaceUsage(userId),
    internalCostSummary(userId, period, billing),
  ]);

  const countsByCategory = new Map<UsageCategory, number>();
  for (const row of usageRows) {
    const category = categoryForModule(row.module);
    countsByCategory.set(
      category,
      (countsByCategory.get(category) ?? 0) + asFiniteNumber(row.used),
    );
  }

  const features = summarizeFeatureUsage(
    countsByCategory,
    subscription.plan,
    billing.market,
  );
  const notifications = await ensureUsageNotifications({
    userId,
    period,
    features,
  });

  return {
    resetAt: period.end,
    periodStart: period.start,
    billing,
    workspace,
    aiThisMonth: features,
    notifications,
    internalCost: cost,
  };
}

export async function requireBusinessPlanGenerationHeadroom(userId: string, module: string) {
  const usage = await getBusinessPlanUsageSnapshot(userId);
  if (!usage || !usage.internalCost.blocked) return { ok: true as const };

  console.error("Business plan AI/provider safety ceiling reached.", {
    userId,
    module,
    billingMarket: usage.internalCost.billingMarket,
    billingCurrency: usage.internalCost.billingCurrency,
    measuredCost: usage.internalCost.measuredCost,
    measuredCostUsd: usage.internalCost.measuredCostUsd,
    totalCogsTarget: usage.internalCost.totalCogsTarget,
    warningThreshold: usage.internalCost.warningThreshold,
    safetyCeiling: usage.internalCost.safetyCeiling,
    usedLegacyFallback: usage.internalCost.usedLegacyFallback,
    unavailableModules: usage.internalCost.unavailableModules,
    periodStart: usage.internalCost.periodStart.toISOString(),
    resetAt: usage.internalCost.resetAt?.toISOString() ?? null,
  });

  return {
    ok: false as const,
    response: Response.json(
      {
        error:
          "This AI feature is temporarily unavailable for the rest of your billing period. Your other Buzypeezy tools remain available.",
        code: "AI_GENERATION_TEMPORARILY_UNAVAILABLE",
        resetAt: usage.resetAt,
      },
      { status: 429 },
    ),
  };
}
