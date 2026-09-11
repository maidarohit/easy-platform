import "server-only";

export const USAGE_CATEGORIES = [
  "projects",
  "standardAiTasks",
  "aiManagerRuns",
  "imageGenerations",
  "videoGenerations",
  "brandingGenerations",
  "marketingGenerations",
  "contentGenerations",
  "websiteGenerations",
  "websiteEdits",
  "seoGenerations",
  "logoGenerations",
  "presentationGenerations",
  "uiuxGenerations",
  "salesGenerations",
  "analyticsGenerations",
  "socialPosts",
  "automationRuns",
  "assistantMessages",
] as const;

export type UsageCategory = (typeof USAGE_CATEGORIES)[number];
export type PaidPlan = "pro" | "business" | "enterprise";

export const PLAN_LIMITS: Record<PaidPlan, Record<UsageCategory, number>> = {
  pro: launchLimits(),
  business: businessPlanLimits(),
  enterprise: launchLimits(),
};

function launchLimits(): Record<UsageCategory, number> {
  return {
    projects: 1,
    standardAiTasks: 100,
    aiManagerRuns: 10,
    imageGenerations: 50,
    videoGenerations: 2,
    brandingGenerations: 10,
    marketingGenerations: 20,
    contentGenerations: 20,
    websiteGenerations: 5,
    websiteEdits: 30,
    seoGenerations: 20,
    logoGenerations: 10,
    presentationGenerations: 5,
    uiuxGenerations: 10,
    salesGenerations: 20,
    analyticsGenerations: 20,
    socialPosts: 30,
    automationRuns: 100,
    assistantMessages: 100,
  };
}

function businessPlanLimits(): Record<UsageCategory, number> {
  return {
    projects: 1,
    standardAiTasks: 100,
    aiManagerRuns: 50,
    imageGenerations: 5,
    videoGenerations: 1,
    brandingGenerations: 5,
    marketingGenerations: 15,
    contentGenerations: 20,
    websiteGenerations: 2,
    websiteEdits: 20,
    seoGenerations: 10,
    logoGenerations: 3,
    presentationGenerations: 2,
    uiuxGenerations: 5,
    salesGenerations: 10,
    analyticsGenerations: 20,
    socialPosts: 30,
    automationRuns: 100,
    assistantMessages: 100,
  };
}

export const MODULE_CATEGORY: Record<string, UsageCategory> = {
  "ai-manager": "aiManagerRuns",
  image: "imageGenerations",
  video: "videoGenerations",
  branding: "brandingGenerations",
  marketing: "marketingGenerations",
  content: "contentGenerations",
  website: "websiteGenerations",
  "website-edit": "websiteEdits",
  seo: "seoGenerations",
  logo: "logoGenerations",
  presentation: "presentationGenerations",
  uiux: "uiuxGenerations",
  sales: "salesGenerations",
  analytics: "analyticsGenerations",
  "automation-social": "socialPosts",
  assistant: "assistantMessages",
  "automation-content": "automationRuns",
  "automation-email": "automationRuns",
  "automation-workflow": "automationRuns",
  "automation-pipeline": "automationRuns",
};

export function categoryForModule(module: string): UsageCategory {
  return MODULE_CATEGORY[module] ?? "standardAiTasks";
}

export function isUsageCategory(value: unknown): value is UsageCategory {
  return typeof value === "string" && USAGE_CATEGORIES.includes(value as UsageCategory);
}
