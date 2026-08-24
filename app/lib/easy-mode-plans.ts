import "server-only";

import type { EasyModeGoalId } from "@/app/lib/easy-mode-goal-options";
import { isEasyModeGoalId } from "@/app/lib/easy-mode-goal-options";
import type { EasyModePlannedModuleId } from "@/app/lib/easy-mode-execution-contracts";

export type EasyModeModule = EasyModePlannedModuleId;

const EASY_MODE_PLANS: Record<EasyModeGoalId, readonly EasyModeModule[]> = {
  build_everything: ["ai-manager", "branding", "website", "marketing", "seo", "uiux", "sales"],
  build_website: ["branding-context", "website", "seo", "uiux"],
  get_customers: ["marketing", "sales", "seo", "content"],
  build_brand: ["branding", "logo", "content"],
  create_content: ["branding-context", "content", "image"],
  improve_business: ["ai-manager", "analytics", "marketing", "sales"],
};

export function resolveEasyModePlan(value: unknown): readonly EasyModeModule[] | null {
  return isEasyModeGoalId(value) ? EASY_MODE_PLANS[value] : null;
}
