export type LaunchCenterSectionState = "Ready" | "Not generated" | "In progress" | "Failed" | "Needs attention";

export type LaunchCenterSection = Readonly<{
  module: string;
  state: LaunchCenterSectionState;
  output: Record<string, unknown> | null;
}>;

export type LaunchCenterPublication = Readonly<{
  status: "unpublished" | "active" | "inactive";
  publicUrl?: string;
  changesAwaitingApproval?: boolean;
}>;

export type LaunchCenterSocialConnection = Readonly<{
  provider: string;
  status: "setup_required" | "connected" | "needs_attention";
}>;

export type LaunchCenterStatusItem = Readonly<{
  label: string;
  status: string;
}>;

export type LaunchCenterNextStep = Readonly<{
  title: string;
  description: string;
  href: string;
}>;

export type LaunchCenterView = Readonly<{
  headline: string;
  description: string;
  websiteSummary: string;
  websitePublicationStatus: string;
  websiteWorkspaceStatus: LaunchCenterSectionState;
  websiteGoal: string | null;
  websitePages: string | null;
  primaryActions: Readonly<{
    previewWebsite: string;
    publishOrEditWebsite: string;
    continueSetup: string;
  }>;
  autopilot: readonly LaunchCenterStatusItem[];
  nextStep: LaunchCenterNextStep;
}>;

function sectionStatus(sections: readonly LaunchCenterSection[], module: string): LaunchCenterSectionState {
  return sections.find((section) => section.module === module)?.state ?? "Not generated";
}

function sectionOutput(sections: readonly LaunchCenterSection[], module: string) {
  return sections.find((section) => section.module === module)?.output ?? null;
}

function stringField(output: Record<string, unknown> | null, field: string): string | null {
  const value = output?.[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function deriveLaunchCenterSocialStatus(
  connections: readonly LaunchCenterSocialConnection[],
): string {
  if (connections.some((connection) => connection.status === "needs_attention")) return "Needs attention";
  if (connections.some((connection) => connection.status === "connected")) return "Connected";
  return "Setup required";
}

export function deriveLaunchCenterNextStep(input: Readonly<{
  projectId: string;
  sections: readonly LaunchCenterSection[];
  publication: LaunchCenterPublication;
  socialConnections: readonly LaunchCenterSocialConnection[];
}>): LaunchCenterNextStep {
  const previewHref = `/business-preview?projectId=${encodeURIComponent(input.projectId)}`;
  const socialHref = `/social?projectId=${encodeURIComponent(input.projectId)}`;
  const seoHref = `/seo-ai?projectId=${encodeURIComponent(input.projectId)}`;
  const advancedHref = `/master-workspace?projectId=${encodeURIComponent(input.projectId)}#advanced-tools`;
  const websiteStatus = sectionStatus(input.sections, "website");
  const marketingStatus = sectionStatus(input.sections, "marketing");
  const seoStatus = sectionStatus(input.sections, "seo");
  const salesStatus = sectionStatus(input.sections, "sales");
  const socialStatus = deriveLaunchCenterSocialStatus(input.socialConnections);

  if (websiteStatus === "Ready" && input.publication.status !== "active") {
    return {
      title: "Preview your website",
      description: "See the website Buzypeezy prepared before you publish or share it.",
      href: previewHref,
    };
  }
  if (input.publication.status === "active" && socialStatus !== "Connected") {
    return {
      title: "Connect social accounts",
      description: "Link your social channels so your website and content setup can work together.",
      href: socialHref,
    };
  }
  if (seoStatus === "Ready") {
    return {
      title: "Review SEO",
      description: "Open your saved SEO plan and review the search foundations prepared for this business.",
      href: seoHref,
    };
  }
  if (marketingStatus !== "Ready" || salesStatus !== "Ready") {
    return {
      title: "Continue Setup with Buzypeezy",
      description: "Open your saved workspace areas and keep shaping the parts that are not ready yet.",
      href: advancedHref,
    };
  }
  return {
    title: "Publish your website",
    description: "Your business workspace is ready. Review the website preview and publish when you are happy with it.",
    href: previewHref,
  };
}

export function buildLaunchCenterView(input: Readonly<{
  projectId: string;
  sections: readonly LaunchCenterSection[];
  publication: LaunchCenterPublication;
  socialConnections: readonly LaunchCenterSocialConnection[];
}>): LaunchCenterView {
  const previewHref = `/business-preview?projectId=${encodeURIComponent(input.projectId)}`;
  const nextStep = deriveLaunchCenterNextStep(input);
  const brandStatus = sectionStatus(input.sections, "branding");
  const websiteStatus = sectionStatus(input.sections, "website");
  const marketingStatus = sectionStatus(input.sections, "marketing");
  const seoStatus = sectionStatus(input.sections, "seo");
  const salesStatus = sectionStatus(input.sections, "sales");
  const socialStatus = deriveLaunchCenterSocialStatus(input.socialConnections);
  const websiteOutput = sectionOutput(input.sections, "website");
  const websiteGoal = stringField(websiteOutput, "websiteGoal");
  const websitePages = stringField(websiteOutput, "recommendedPages");
  const websiteSummary = stringField(websiteOutput, "websiteOverview") || "Your saved website preview is ready to review.";
  const coreReady = brandStatus === "Ready" && websiteStatus === "Ready";

  return {
    headline: coreReady ? "Your business is ready" : "Welcome back to your business",
    description: coreReady
      ? "Buzypeezy has prepared your brand, website and business workspace."
      : "Your saved business setup is waiting here, ready for the next step.",
    websiteSummary,
    websitePublicationStatus: input.publication.changesAwaitingApproval
      ? "Changes awaiting approval"
      : input.publication.status === "active"
        ? "Published"
        : "Not published",
    websiteWorkspaceStatus: websiteStatus,
    websiteGoal,
    websitePages,
    primaryActions: {
      previewWebsite: previewHref,
      publishOrEditWebsite: previewHref,
      continueSetup: nextStep.href,
    },
    autopilot: [
      { label: "Brand ready", status: brandStatus },
      { label: "Website ready", status: websiteStatus },
      { label: "SEO foundation", status: seoStatus },
      { label: "Marketing", status: marketingStatus },
      { label: "Sales", status: salesStatus },
      { label: "Social connections", status: socialStatus },
    ],
    nextStep,
  };
}
