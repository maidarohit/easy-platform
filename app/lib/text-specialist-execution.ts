import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projectMemory, projects } from "@/app/db/schema";
import { getModuleAdapter, type EasyModeModuleId, type ModuleExecutionInput, type TrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { executeValidatedJsonWebhook, SpecialistExecutionError } from "@/app/lib/specialist-execution";

export const TEXT_SPECIALIST_MODULES = ["website", "marketing", "seo", "uiux", "sales", "analytics"] as const;
export type TextSpecialistModule = (typeof TEXT_SPECIALIST_MODULES)[number];

const CONFIG = {
  website: { workflow: "website-ai", env: "N8N_WEBSITE_AI_WEBHOOK_URL", label: "Website" },
  marketing: { workflow: "marketing-ai", env: "N8N_MARKETING_AI_WEBHOOK_URL", label: "Marketing" },
  seo: { workflow: "seo-ai", env: "N8N_SEO_AI_WEBHOOK_URL", label: "Search visibility" },
  uiux: { workflow: "uiux-ai", env: "N8N_UIUX_AI_WEBHOOK_URL", label: "Customer experience" },
  sales: { workflow: "sales-ai", env: "N8N_SALES_AI_WEBHOOK_URL", label: "Sales" },
  analytics: { workflow: "analytics-ai", env: "N8N_ANALYTICS_AI_WEBHOOK_URL", label: "Business insights" },
} as const;

export function getTextSpecialistConfig(module: TextSpecialistModule) {
  return CONFIG[module];
}

export async function loadCanonicalTextSpecialistInput(
  context: TrustedModuleExecutionContext,
  module: TextSpecialistModule,
): Promise<ModuleExecutionInput> {
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, context.projectId), eq(projects.userId, context.userId),
  )).limit(1);
  if (!project) throw new SpecialistExecutionError("before_dispatch", 404);
  const [memory] = await db.select().from(projectMemory).where(and(
    eq(projectMemory.projectId, context.projectId), eq(projectMemory.userId, context.userId),
  )).limit(1);
  const companyName = memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim();
  const industry = memory?.industry?.trim() || project.industry?.trim() || "Business services";
  const targetAudience = memory?.targetAudience?.trim() || project.targetAudience?.trim() || `Customers interested in ${industry}`;
  const brandStyle = memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional";
  const brandDescription = memory?.businessDescription?.trim() || project.brandDescription?.trim() ||
    project.originalBrief?.trim() || `${companyName} provides ${industry.toLowerCase()} products or services.`;
  let candidate: Record<string, string>;
  if (module === "sales") {
    candidate = { companyName, industry, targetAudience, businessDescription: brandDescription,
      salesGoal: memory?.marketingGoal?.trim() || project.goal?.trim() || "Grow sales" };
  } else if (module === "analytics") {
    candidate = {
      companyName, industry, businessDescription: brandDescription,
      monthlyVisitors: "Not provided", monthlyLeads: "Not provided", monthlySales: "Not provided",
      monthlyRevenue: "Not provided", marketingBudget: "Not provided",
      businessGoal: project.goal?.trim() || "Improve business performance",
    };
  } else {
    candidate = { companyName, industry, targetAudience, brandStyle, brandDescription };
  }
  const input = getModuleAdapter(module)?.validateInput(candidate);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  return input;
}

export async function executeTextSpecialistService(options: Readonly<{
  module: TextSpecialistModule;
  context: TrustedModuleExecutionContext;
  input?: unknown;
  fetcher?: typeof fetch;
  webhookConfig?: Readonly<{ url: string; headers: Readonly<Record<string, string>> }>;
}>) {
  const input = options.input === undefined
    ? await loadCanonicalTextSpecialistInput(options.context, options.module)
    : getModuleAdapter(options.module)?.validateInput(options.input);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  const validator = getModuleAdapter(options.module as EasyModeModuleId)?.validateOutput;
  const config = CONFIG[options.module];
  return executeValidatedJsonWebhook({
    input,
    webhook: options.webhookConfig ?? getN8nWebhookConfig(config.env),
    timeoutMs: 120_000,
    fetcher: options.fetcher,
    validateResponse(value) {
      const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
      const wrapped = item !== null && typeof item === "object" && !Array.isArray(item) && Object.hasOwn(item, "output")
        ? { output: (item as Record<string, unknown>).output } : item;
      return validator?.(item) ?? validator?.(wrapped) ?? null;
    },
  });
}
