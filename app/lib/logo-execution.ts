import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import {
  getModuleAdapter,
  type ModuleExecutionInput,
  type TrustedModuleExecutionContext,
} from "@/app/lib/easy-mode-execution-contracts";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { executeValidatedJsonWebhook, SpecialistExecutionError } from "@/app/lib/specialist-execution";
import { loadOwnedProjectContext } from "@/app/lib/easy-mode-project-context";

export const LOGO_AI_WORKFLOW = "logo-ai";

export async function loadCanonicalLogoInput(context: TrustedModuleExecutionContext): Promise<ModuleExecutionInput> {
  const [ownedContext, brandingRows] = await Promise.all([
    loadOwnedProjectContext(context),
    db.select({ result: projectOutputs.result }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, context.projectId), eq(projectOutputs.userId, context.userId),
      eq(projectOutputs.module, "branding"),
    )).orderBy(desc(projectOutputs.createdAt)).limit(1),
  ]);
  if (!ownedContext) throw new SpecialistExecutionError("before_dispatch", 404);
  const { project, memory } = ownedContext;
  const [branding] = brandingRows;
  let brandingOutput: Readonly<Record<string, unknown>> | null = null;
  try {
    brandingOutput = branding ? getModuleAdapter("branding")?.validateOutput?.(JSON.parse(branding.result)) ?? null : null;
  } catch {
    brandingOutput = null;
  }
  const candidate = {
    companyName: memory?.businessName?.trim() || project.companyName?.trim() || project.name.trim(),
    industry: memory?.industry?.trim() || project.industry?.trim() || "Business services",
    brandStyle: memory?.brandStyle?.trim() || project.brandStyle?.trim() || "Professional",
    logoIdea: typeof brandingOutput?.logoConcept === "string" ? brandingOutput.logoConcept :
      project.brandDescription?.trim() || project.originalBrief?.trim() || "A clear, memorable business logo.",
  };
  const input = getModuleAdapter("logo")?.validateInput(candidate);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  return input;
}

export async function executeLogoService(options: Readonly<{
  context: TrustedModuleExecutionContext;
  input?: unknown;
  fetcher?: typeof fetch;
  webhookConfig?: Readonly<{ url: string; headers: Readonly<Record<string, string>> }>;
}>) {
  const input = options.input === undefined ? await loadCanonicalLogoInput(options.context) :
    getModuleAdapter("logo")?.validateInput(options.input);
  if (!input) throw new SpecialistExecutionError("before_dispatch", 400);
  const validator = getModuleAdapter("logo")?.validateOutput;
  return executeValidatedJsonWebhook({
    input,
    webhook: options.webhookConfig ?? getN8nWebhookConfig("N8N_LOGO_AI_WEBHOOK_URL"),
    timeoutMs: 60_000,
    fetcher: options.fetcher,
    validateResponse(value) {
      const item = Array.isArray(value) && value.length === 1 ? value[0] : value;
      const output = item !== null && typeof item === "object" && !Array.isArray(item) && Object.hasOwn(item, "output")
        ? (item as Record<string, unknown>).output : item;
      return validator?.(item) ?? validator?.(output) ?? null;
    },
  });
}
