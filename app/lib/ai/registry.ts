import type {
  AiModuleId,
  AiModuleRegistryEntry,
  InternalAiModuleId,
} from "./types";

const modules = [
  { id: "ai-manager", name: "AI Manager", category: "manager", frontendPath: "/ai-manager", integration: "internal-api", apiEndpoint: "/api/ai-manager", responseKind: "json", orchestrationReady: false },
  { id: "analytics-ai", name: "Analytics AI", category: "strategy", frontendPath: "/analytics-ai", integration: "internal-api", apiEndpoint: "/api/analytics-ai", responseKind: "json", orchestrationReady: true },
  { id: "branding-ai", name: "Branding AI", category: "strategy", frontendPath: "/branding-ai", integration: "internal-api", apiEndpoint: "/api/branding-ai", responseKind: "json", orchestrationReady: true },
  { id: "website-ai", name: "Website AI", category: "strategy", frontendPath: "/dashboard/website-ai", integration: "internal-api", apiEndpoint: "/api/website-ai", responseKind: "json", orchestrationReady: true },
  { id: "marketing-ai", name: "Marketing AI", category: "strategy", frontendPath: "/marketing-ai", integration: "internal-api", apiEndpoint: "/api/marketing-ai", responseKind: "json", orchestrationReady: true },
  { id: "sales-ai", name: "Sales AI", category: "strategy", frontendPath: "/sales-ai", integration: "internal-api", apiEndpoint: "/api/sales-ai", responseKind: "json", orchestrationReady: true },
  { id: "seo-ai", name: "SEO AI", category: "strategy", frontendPath: "/seo-ai", integration: "internal-api", apiEndpoint: "/api/seo-ai", responseKind: "json", orchestrationReady: true },
  { id: "uiux-ai", name: "UI/UX AI", category: "strategy", frontendPath: "/uiux-ai", integration: "internal-api", apiEndpoint: "/api/uiux-ai", responseKind: "json", orchestrationReady: true },
  { id: "content-ai", name: "Content AI", category: "content", frontendPath: "/dashboard/content-ai", integration: "internal-api", apiEndpoint: "/api/content-ai", responseKind: "json", orchestrationReady: true },
  { id: "logo-ai", name: "Logo AI", category: "creative", frontendPath: "/dashboard/logo-ai", integration: "internal-api", apiEndpoint: "/api/logo-ai", responseKind: "json", orchestrationReady: true },
  { id: "image-ai", name: "Image AI", category: "creative", frontendPath: "/dashboard/image-ai", integration: "internal-api", apiEndpoint: "/api/image-ai", responseKind: "image", orchestrationReady: true },
  { id: "presentation-ai", name: "Presentation AI", category: "content", frontendPath: "/dashboard/presentation-ai", integration: "internal-api", apiEndpoint: "/api/presentation-ai", responseKind: "json", orchestrationReady: true },
  { id: "video-ai", name: "Video AI", category: "creative", frontendPath: "/dashboard/video-ai", integration: "internal-api", apiEndpoint: "/api/video-ai", responseKind: "video", orchestrationReady: true },
  { id: "creative-ai", name: "Creative AI", category: "creative", frontendPath: "/dashboard/creative-ai", integration: "ui-only", apiEndpoint: null, responseKind: "json", orchestrationReady: false },
  { id: "automation-content", name: "Content Automation", category: "automation", frontendPath: "/dashboard/automation", integration: "internal-api", apiEndpoint: "/api/automation/content", responseKind: "json", orchestrationReady: true },
  { id: "automation-email", name: "Email Automation", category: "automation", frontendPath: "/dashboard/automation", integration: "internal-api", apiEndpoint: "/api/automation/email", responseKind: "json", orchestrationReady: true },
  { id: "automation-social", name: "Social Automation", category: "automation", frontendPath: "/dashboard/automation", integration: "internal-api", apiEndpoint: "/api/automation/social", responseKind: "json", orchestrationReady: true },
  { id: "automation-workflow", name: "Workflow Automation", category: "automation", frontendPath: "/dashboard/automation", integration: "internal-api", apiEndpoint: "/api/automation/workflow", responseKind: "json", orchestrationReady: true },
  { id: "automation-pipeline", name: "AI Pipeline Automation", category: "automation", frontendPath: "/dashboard/automation", integration: "internal-api", apiEndpoint: "/api/automation/pipeline", responseKind: "json", orchestrationReady: true },
] as const satisfies readonly AiModuleRegistryEntry[];

export const AI_MODULE_REGISTRY: Readonly<
  Record<AiModuleId, AiModuleRegistryEntry>
> = Object.freeze(
  Object.fromEntries(
    modules.map((definition) => [definition.id, Object.freeze(definition)])
  )
) as Readonly<Record<AiModuleId, AiModuleRegistryEntry>>;

export const AI_MODULES: readonly AiModuleRegistryEntry[] = modules;

export function getAiModule<TModule extends AiModuleId>(
  moduleId: TModule
): AiModuleRegistryEntry & { id: TModule } {
  return AI_MODULE_REGISTRY[moduleId] as AiModuleRegistryEntry & {
    id: TModule;
  };
}

export function getInternalAiModule(
  moduleId: InternalAiModuleId
): AiModuleRegistryEntry & {
  id: InternalAiModuleId;
  integration: "internal-api";
  apiEndpoint: `/api/${string}`;
} {
  const definition = getAiModule(moduleId);

  if (
    definition.integration !== "internal-api" ||
    !definition.apiEndpoint
  ) {
    throw new Error(
      `${definition.name} does not have an internal API endpoint.`
    );
  }

  return definition as AiModuleRegistryEntry & {
    id: InternalAiModuleId;
    integration: "internal-api";
    apiEndpoint: `/api/${string}`;
  };
}
