import "server-only";

import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";

export const AI_COST_PRICING_VERSION = "2026-08-16";

const TOKEN_PRICING = {
  openai: {
    "gpt-5-mini": {
      inputUsdPerMillionTokens: 0.25,
      outputUsdPerMillionTokens: 2,
    },
  },
} as const;

type TokenCostInput = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

function isValidTokenCount(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function calculateTokenCostUsd({
  model,
  inputTokens,
  outputTokens,
}: TokenCostInput): string {
  return calculateTokenComponentsCostUsd([
    { provider: "openai", model, inputTokens, outputTokens },
  ]);
}

export function calculateTokenComponentsCostUsd(
  components: readonly AiUsageComponent[]
): string {
  let estimatedCostUsd = 0;

  for (const component of components) {
    const providerPricing =
      TOKEN_PRICING[component.provider as keyof typeof TOKEN_PRICING];
    const pricing = providerPricing?.[
      component.model as keyof typeof providerPricing
    ];

    if (
      !pricing ||
      !isValidTokenCount(component.inputTokens) ||
      !isValidTokenCount(component.outputTokens)
    ) {
      continue;
    }

    estimatedCostUsd +=
      (component.inputTokens * pricing.inputUsdPerMillionTokens +
        component.outputTokens * pricing.outputUsdPerMillionTokens) /
      1_000_000;
  }

  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
    return "0";
  }

  if (estimatedCostUsd === 0) {
    return "0";
  }

  return estimatedCostUsd.toFixed(6);
}
