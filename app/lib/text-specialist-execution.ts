import "server-only";

import { getModuleAdapter, type EasyModeModuleId, type ModuleExecutionInput, type TrustedModuleExecutionContext } from "@/app/lib/easy-mode-execution-contracts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import {
  executeValidatedJsonWebhook,
  SpecialistExecutionError,
  type SpecialistExecutionResult,
  type SyncSpecialistExecutionResult,
  type SpecialistAsyncDispatchContext,
  validateWrappedWebhookOutput,
} from "@/app/lib/specialist-execution";
import { confirmedDnaExecutionContext, loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";
import { loadOwnedSalesContext } from "@/app/lib/sales-business-context";
import { validateSalesWebhookOutput } from "@/app/lib/sales-insight-safety";

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
  const ownedContext = await loadOwnedProjectContext(context);
  if (!ownedContext) throw new SpecialistExecutionError("before_dispatch", 404);
  const { project, memory } = ownedContext;
  const dna = confirmedDnaExecutionContext(ownedContext);
  const companyName = dna?.companyName || memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim();
  const industry = dna?.industry || memory?.industry?.trim() || project.industry?.trim() || "Business services";
  const targetAudience = (dna?.targetAudience || memory?.targetAudience?.trim() || project.targetAudience?.trim() ||
    `Customers interested in ${industry}`).slice(0, 500);
  const brandStyle = (dna?.brandStyle || memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional").slice(0, 500);
  const brandDescription = dna?.businessDescription || memory?.businessDescription?.trim() || project.brandDescription?.trim() ||
    project.originalBrief?.trim() || `${companyName} provides ${industry.toLowerCase()} products or services.`;
  let candidate: Record<string, string>;
  if (module === "sales") {
    candidate = { companyName, industry, targetAudience, businessDescription: brandDescription,
      salesGoal: dna?.businessGoal || memory?.marketingGoal?.trim() || project.goal?.trim() || "Grow sales" };
  } else if (module === "analytics") {
    candidate = {
      companyName, industry, businessDescription: brandDescription,
      monthlyVisitors: "Not provided", monthlyLeads: "Not provided", monthlySales: "Not provided",
      monthlyRevenue: "Not provided", marketingBudget: "Not provided",
      businessGoal: dna?.businessGoal || project.goal?.trim() || "Improve business performance",
    };
  } else {
    candidate = { companyName, industry, targetAudience, brandStyle, brandDescription };
  }
  const input = getModuleAdapter(module)?.validateInput(candidate);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  return input;
}

export function validateTextSpecialistWebhookOutput(module: TextSpecialistModule, value: unknown) {
  const validator = getModuleAdapter(module as EasyModeModuleId)?.validateOutput;
  return validator ? validateWrappedWebhookOutput(value, validator) : null;
}

type TextSpecialistExecutionOptions = Readonly<{
  module: TextSpecialistModule;
  context: TrustedModuleExecutionContext;
  input?: unknown;
  asyncDispatch?: SpecialistAsyncDispatchContext;
  salesValidationContext?: Awaited<ReturnType<typeof loadOwnedSalesContext>> | null;
  fetcher?: typeof fetch;
  webhookConfig?: Readonly<{ url: string; headers: Readonly<Record<string, string>> }>;
}>;

export function executeTextSpecialistService(
  options: TextSpecialistExecutionOptions & Readonly<{ asyncDispatch?: undefined }>,
): Promise<SyncSpecialistExecutionResult>;
export function executeTextSpecialistService(
  options: TextSpecialistExecutionOptions & Readonly<{ asyncDispatch: SpecialistAsyncDispatchContext }>,
): Promise<SpecialistExecutionResult>;
export async function executeTextSpecialistService(options: TextSpecialistExecutionOptions) {
  const input = options.input === undefined
    ? await loadCanonicalTextSpecialistInput(options.context, options.module)
    : getModuleAdapter(options.module)?.validateInput(options.input);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  const salesContext = options.module === "sales"
    ? (options.salesValidationContext ?? await loadOwnedSalesContext(options.context.userId, options.context.projectId))
    : null;
  if (options.module === "sales" && !salesContext) throw new SpecialistExecutionError("before_dispatch", 404);
  const validateResponse = options.module === "sales"
    ? (value: unknown) => validateSalesWebhookOutput(value, salesContext!)
    : (value: unknown) => validateTextSpecialistWebhookOutput(options.module, value);
  const config = CONFIG[options.module];
  const baseOptions = {
    input,
    webhook: options.webhookConfig ?? getN8nWebhookConfig(config.env),
    timeoutMs: 120_000,
    fetcher: options.fetcher,
    validateResponse,
  } as const;
  if (options.asyncDispatch) {
    return executeValidatedJsonWebhook({
      ...baseOptions,
      asyncDispatch: options.asyncDispatch,
    });
  }
  return executeValidatedJsonWebhook(baseOptions);
}
