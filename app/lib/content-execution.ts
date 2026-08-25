import "server-only";

import {
  getModuleAdapter,
  type ModuleExecutionInput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { executeValidatedJsonWebhook, SpecialistExecutionError } from "@/app/lib/specialist-execution";
import { loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";

export const CONTENT_AI_WORKFLOW = "content-ai";

export async function loadCanonicalContentInput(context: TrustedModuleExecutionContext): Promise<ModuleExecutionInput> {
  const ownedContext = await loadOwnedProjectContext(context);
  if (!ownedContext) throw new SpecialistExecutionError("before_dispatch", 404);
  const { project, memory } = ownedContext;
  const companyName = memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim();
  const industry = memory?.industry?.trim() || project.industry?.trim() || "business services";
  const candidate = {
    prompt: `Create useful introductory marketing content for ${companyName}, a ${industry} business.`,
    contentType: "Business introduction",
    tone: memory?.brandVoice?.trim() || memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional and friendly",
    audience: memory?.targetAudience?.trim() || project.targetAudience?.trim() || `Customers interested in ${industry}`,
    length: "Medium",
    keywords: `${companyName}, ${industry}`,
  };
  const input = getModuleAdapter("content")?.validateInput(candidate);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  return input;
}

export async function executeContentService(options: Readonly<{
  context: TrustedModuleExecutionContext;
  input?: unknown;
  fetcher?: typeof fetch;
  webhookConfig?: Readonly<{ url: string; headers: Readonly<Record<string, string>> }>;
}>) {
  const input = options.input === undefined ? await loadCanonicalContentInput(options.context) :
    getModuleAdapter("content")?.validateInput(options.input);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  const validator = getModuleAdapter("content")?.validateOutput;
  return executeValidatedJsonWebhook({
    input,
    webhook: options.webhookConfig ?? getN8nWebhookConfig("N8N_CONTENT_AI_WEBHOOK_URL"),
    timeoutMs: 120_000,
    fetcher: options.fetcher,
    validateResponse(value) {
      const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
      if (item === null || typeof item !== "object" || Array.isArray(item)) return validator?.(item) ?? null;
      const record = item as Record<string, unknown>;
      for (const key of ["output", "content", "text", "result"] as const) {
        if (Object.hasOwn(record, key)) {
          const validated = validator?.(record[key]);
          if (validated) return validated;
        }
      }
      return validator?.(item) ?? null;
    },
  });
}
