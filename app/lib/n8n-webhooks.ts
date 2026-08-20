import "server-only";

export const N8N_WEBHOOK_SECRET_HEADER =
  "X-Buzypeezy-Webhook-Secret";

export type N8nWebhookEnvironmentVariable =
  | "N8N_AI_MANAGER_WEBHOOK_URL"
  | "N8N_ANALYTICS_AI_WEBHOOK_URL"
  | "N8N_AUTOMATION_CONTENT_WEBHOOK_URL"
  | "N8N_AUTOMATION_EMAIL_WEBHOOK_URL"
  | "N8N_AUTOMATION_PIPELINE_WEBHOOK_URL"
  | "N8N_AUTOMATION_SOCIAL_WEBHOOK_URL"
  | "N8N_AUTOMATION_WORKFLOW_WEBHOOK_URL"
  | "N8N_BRANDING_AI_WEBHOOK_URL"
  | "N8N_CONTENT_AI_WEBHOOK_URL"
  | "N8N_IMAGE_AI_WEBHOOK_URL"
  | "N8N_LOGO_AI_WEBHOOK_URL"
  | "N8N_MARKETING_AI_WEBHOOK_URL"
  | "N8N_PRESENTATION_AI_WEBHOOK_URL"
  | "N8N_SALES_AI_WEBHOOK_URL"
  | "N8N_SEO_AI_WEBHOOK_URL"
  | "N8N_UIUX_AI_WEBHOOK_URL"
  | "N8N_VIDEO_AI_WEBHOOK_URL"
  | "N8N_WEBSITE_AI_WEBHOOK_URL";

type N8nWebhookConfig = {
  url: string;
  headers: Record<string, string>;
};

export function getN8nWebhookConfig(
  environmentVariable: N8nWebhookEnvironmentVariable
): N8nWebhookConfig | null {
  const configuredUrl = process.env[environmentVariable]?.trim();
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();

  if (!configuredUrl || !secret) return null;

  try {
    const url = new URL(configuredUrl);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return {
      url: url.toString(),
      headers: {
        "Content-Type": "application/json",
        [N8N_WEBHOOK_SECRET_HEADER]: secret,
      },
    };
  } catch {
    return null;
  }
}

export function n8nConfigurationErrorResponse() {
  return Response.json(
    { error: "AI service configuration is unavailable." },
    { status: 503 }
  );
}
