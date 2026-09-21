import { handleProspectPreview } from "@/app/lib/prospect-preview-handler";
import { createProspectPreviewStore } from "@/app/lib/prospect-preview-store";
import { generateWebsiteAi } from "@/app/lib/website-ai-generation";
import { getN8nWebhookConfig } from "@/app/lib/n8n-webhooks";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  return handleProspectPreview(request, {
    store: createProspectPreviewStore(),
    generate: generateWebsiteAi,
    configuration: () => {
      const origin = canonicalApplicationOrigin();
      const webhook = getN8nWebhookConfig("N8N_WEBSITE_AI_WEBHOOK_URL");
      return origin && webhook ? { origin, webhook } : null;
    },
  });
}
