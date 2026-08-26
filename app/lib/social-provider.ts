import "server-only";

export const SOCIAL_PROVIDERS = ["meta", "linkedin"] as const;
export type SocialProviderName = (typeof SOCIAL_PROVIDERS)[number];

export const socialProviderSetup = (provider: SocialProviderName) => ({
  provider,
  configured: false,
  status: "setup_required" as const,
  message: "Social publishing setup is not connected yet.",
});

export async function publishSocialPost(): Promise<never> {
  throw new Error("SOCIAL_PROVIDER_NOT_CONFIGURED");
}
