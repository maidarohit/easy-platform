import "server-only";

export const USAGE_CATEGORIES = [
  "projects",
  "standardAiTasks",
  "aiManagerRuns",
  "imageGenerations",
  "videoGenerations",
  "presentationGenerations",
  "automationRuns",
  "assistantMessages",
] as const;

export type UsageCategory = (typeof USAGE_CATEGORIES)[number];
export type PaidPlan = "pro" | "business" | "enterprise";

// NON-COMMERCIAL PLACEHOLDERS. Replace after pre-launch usage validation.
export const PLAN_LIMITS: Record<PaidPlan, Record<UsageCategory, number>> = {
  pro: { projects: 3, standardAiTasks: 50, aiManagerRuns: 5, imageGenerations: 10, videoGenerations: 2, presentationGenerations: 5, automationRuns: 20, assistantMessages: 100 },
  business: { projects: 10, standardAiTasks: 200, aiManagerRuns: 20, imageGenerations: 40, videoGenerations: 3, presentationGenerations: 20, automationRuns: 100, assistantMessages: 500 },
  enterprise: { projects: 0, standardAiTasks: 0, aiManagerRuns: 0, imageGenerations: 0, videoGenerations: 0, presentationGenerations: 0, automationRuns: 0, assistantMessages: 0 },
};

export const MODULE_CATEGORY: Record<string, UsageCategory> = {
  "ai-manager": "aiManagerRuns",
  image: "imageGenerations",
  video: "videoGenerations",
  presentation: "presentationGenerations",
  assistant: "assistantMessages",
  "automation-content": "automationRuns",
  "automation-email": "automationRuns",
  "automation-social": "automationRuns",
  "automation-workflow": "automationRuns",
  "automation-pipeline": "automationRuns",
};

export function categoryForModule(module: string): UsageCategory {
  return MODULE_CATEGORY[module] ?? "standardAiTasks";
}

export function isUsageCategory(value: unknown): value is UsageCategory {
  return typeof value === "string" && USAGE_CATEGORIES.includes(value as UsageCategory);
}
