export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AiModuleId =
  | "ai-manager"
  | "analytics-ai"
  | "branding-ai"
  | "website-ai"
  | "marketing-ai"
  | "sales-ai"
  | "seo-ai"
  | "uiux-ai"
  | "content-ai"
  | "logo-ai"
  | "image-ai"
  | "presentation-ai"
  | "video-ai"
  | "creative-ai"
  | "automation-content"
  | "automation-email"
  | "automation-social"
  | "automation-workflow"
  | "automation-pipeline";

export type InternalAiModuleId = Exclude<
  AiModuleId,
  "creative-ai"
>;

export type OrchestratableAiModuleId = Exclude<
  InternalAiModuleId,
  "ai-manager"
>;

export type AiModuleCategory =
  | "manager"
  | "strategy"
  | "creative"
  | "content"
  | "automation";

export type AiModuleIntegration =
  | "internal-api"
  | "legacy-direct-upstream"
  | "ui-only";

export type AiModuleResponseKind = "json" | "image" | "video";

export interface BrandProfileInput {
  companyName: string;
  industry: string;
  targetAudience: string;
  brandStyle: string;
  brandDescription: string;
}

export interface BrandingAiOutput {
  brandName: string;
  tagline: string;
  story: string;
  mission: string;
  vision: string;
  brandVoice: string;
  colorPalette: string;
  typography: string;
  logoConcept: string;
  marketingSuggestions: string;
  brandStyleGuide: string;
}

export interface WebsiteAiOutput {
  websiteOverview: string;
  websiteGoal: string;
  recommendedPages: string;
  siteStructure: string;
  websiteFeatures: string;
  designRecommendations: string;
  colourScheme: string;
  typography: string;
  recommendedTechStack: string;
  seoRecommendations: string;
  websiteEdits?: WebsiteEdits;
}

export interface WebsiteEdits {
  companyName: string;
  heroHeadline: string;
  heroDescription: string;
  aboutText: string;
  servicesText: string;
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  primaryCtaLabel: string;
  primaryCtaLink: string;
  template: string;
}

export interface AiManagerInput {
  companyName: string;
  businessDescription: string;
  industry: string;
  businessGoal: string;
  projectId?: string;
  userId?: string;
  analyticsContext?: unknown;
}

export interface AiManagerStrategy {
  overview: string;
  branding: string;
  website: string;
  marketing: string;
  seo: string;
  uiux: string;
  sales: string;
  analytics: string;
}

export interface AiManagerOutput {
  output: AiManagerStrategy;
}

export type AiManagerJobStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalyticsAiInput extends AiManagerInput {
  monthlyVisitors: string;
  monthlyLeads: string;
  monthlySales: string;
  monthlyRevenue: string;
  marketingBudget: string;
}

export interface MarketingAiInput extends BrandProfileInput {
  regenerateSection?: string;
  currentResult?: unknown;
  editInstruction?: string;
  mode?: "edit";
}

export interface SalesAiInput {
  companyName: string;
  industry: string;
  salesGoal: string;
  targetAudience: string;
  businessDescription: string;
}

export interface ContentAiInput {
  prompt: string;
  contentType: string;
  tone: string;
  audience: string;
  length: string;
  keywords: string;
}

export interface LogoAiInput {
  companyName: string;
  industry: string;
  brandStyle: string;
  logoIdea: string;
}

export interface ImageAiInput {
  prompt: string;
  style: string;
  size: string;
}

export interface PresentationAiInput {
  topic: string;
  presentationType: string;
  audience: string;
  tone: string;
  slideCount: string;
  keyPoints: string;
  designStyle: string;
}

export interface VideoAiInput {
  prompt: string;
  style: string;
  duration: string;
  videoType: string;
  scene: string;
  cameraMovement: string;
  lighting: string;
  importantDetails: string;
  negativePrompt: string;
  colorPalette: string;
  aspectRatio: string;
}

export interface AutomationContentInput {
  businessName: string;
  contentType: string;
  targetAudience: string;
  tone: string;
  topic: string;
  instructions: string;
}

export type AutomationEmailInput = Omit<
  AutomationContentInput,
  "contentType"
>;

export interface AutomationSocialInput extends AutomationEmailInput {
  platform: string;
  postType: string;
}

export interface AutomationWorkflowInput {
  businessName: string;
  automationGoal: string;
  trigger: string;
  actions: string;
  tools: string;
  instructions: string;
}

export interface AutomationPipelineInput {
  businessName: string;
  pipelineGoal: string;
  capabilities: string;
  instructions: string;
}

export interface AiModuleInputMap {
  "ai-manager": AiManagerInput;
  "analytics-ai": AnalyticsAiInput;
  "branding-ai": BrandProfileInput;
  "website-ai": BrandProfileInput;
  "marketing-ai": MarketingAiInput;
  "sales-ai": SalesAiInput;
  "seo-ai": BrandProfileInput;
  "uiux-ai": BrandProfileInput;
  "content-ai": ContentAiInput;
  "logo-ai": LogoAiInput;
  "image-ai": ImageAiInput;
  "presentation-ai": PresentationAiInput;
  "video-ai": VideoAiInput;
  "creative-ai": Record<string, never>;
  "automation-content": AutomationContentInput;
  "automation-email": AutomationEmailInput;
  "automation-social": AutomationSocialInput;
  "automation-workflow": AutomationWorkflowInput;
  "automation-pipeline": AutomationPipelineInput;
}

export interface AiModuleRegistryEntry {
  id: AiModuleId;
  name: string;
  category: AiModuleCategory;
  frontendPath: string;
  integration: AiModuleIntegration;
  apiEndpoint: `/api/${string}` | null;
  legacyDirectEndpoint?: `https://${string}`;
  responseKind: AiModuleResponseKind;
  orchestrationReady: boolean;
}

export interface ModuleOutputReference {
  moduleId: AiModuleId;
  runId?: string;
  output: unknown;
}

export interface ModuleInvocation<TModule extends AiModuleId = AiModuleId> {
  moduleId: TModule;
  input: AiModuleInputMap[TModule];
  projectId?: string;
  context?: Record<string, unknown>;
  upstreamOutputs?: ModuleOutputReference[];
}

export type ModuleRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export interface ModuleResultEnvelope<TOutput = unknown> {
  moduleId: AiModuleId;
  status: ModuleRunStatus;
  output?: TOutput;
  rawOutput?: unknown;
  error?: string;
  runId?: string;
  projectId?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JsonApiResult<T = unknown> {
  kind: "json";
  data: T;
  status: number;
  contentType: string;
}

export interface BinaryApiResult {
  kind: "binary";
  data: Blob;
  status: number;
  contentType: string;
}

export type AiApiResult<T = unknown> = JsonApiResult<T> | BinaryApiResult;

export interface AiOrchestrationStep<
  TModule extends OrchestratableAiModuleId = OrchestratableAiModuleId,
> {
  id: string;
  moduleId: TModule;
  input: AiModuleInputMap[TModule];
  includeOutputsFrom?: string[];
}

export interface AiOrchestrationRequest {
  steps: AiOrchestrationStep[];
  context?: Record<string, unknown>;
}

export interface BinaryModuleOutput {
  kind: "binary";
  contentType: string;
  size: number;
}

export interface AiOrchestrationStepResult {
  stepId: string;
  moduleId: OrchestratableAiModuleId;
  moduleName: string;
  status: "succeeded" | "failed";
  output?: unknown;
  error?: {
    message: string;
    status?: number;
    details?: string;
  };
  startedAt: string;
  completedAt: string;
}

export interface AiOrchestrationResult {
  status: "succeeded" | "partial" | "failed";
  results: AiOrchestrationStepResult[];
  startedAt: string;
  completedAt: string;
}
