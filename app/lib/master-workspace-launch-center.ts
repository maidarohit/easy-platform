import { withProjectId } from "@/app/lib/project-navigation";

export type LaunchCenterSectionState = "Ready" | "Not generated" | "In progress" | "Failed" | "Needs attention";

export type LaunchCenterSection = Readonly<{
  module: string;
  state: LaunchCenterSectionState;
  output: Record<string, unknown> | null;
  reviewState?: "Approved" | "Needs review" | null;
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

function sectionReviewState(sections: readonly LaunchCenterSection[], module: string) {
  return sections.find((section) => section.module === module)?.reviewState ?? null;
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
  const previewHref = withProjectId("/business-preview", input.projectId);
  const socialHref = withProjectId("/social", input.projectId);
  const storeHref = withProjectId("/store", input.projectId);
  const automationHref = withProjectId("/dashboard/automation", input.projectId);
  const advancedHref = withProjectId("/master-workspace#advanced-tools", input.projectId);
  const websiteStatus = sectionStatus(input.sections, "website");
  const websiteReviewState = sectionReviewState(input.sections, "website");
  const marketingStatus = sectionStatus(input.sections, "marketing");
  const seoStatus = sectionStatus(input.sections, "seo");
  const salesStatus = sectionStatus(input.sections, "sales");
  const socialStatus = deriveLaunchCenterSocialStatus(input.socialConnections);

  if (websiteStatus === "Ready" && websiteReviewState !== "Approved") {
    return {
      title: "Preview your website",
      description: "Review the saved website before you publish or make changes.",
      href: previewHref,
    };
  }
  if (websiteStatus === "Ready" && input.publication.status !== "active") {
    return {
      title: "Publish your website",
      description: "Your approved website is ready to go live when you are.",
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
  if (input.publication.status === "active" && marketingStatus === "Ready" && seoStatus === "Ready" && salesStatus === "Ready") {
    return {
      title: "Add products/services",
      description: "Complete the offers your customers will see when they land on your business.",
      href: storeHref,
    };
  }
  if (websiteStatus !== "Ready" || marketingStatus !== "Ready" || seoStatus !== "Ready" || salesStatus !== "Ready") {
    return {
      title: "Continue Setup with Buzypeezy",
      description: "Open your saved workspace areas and keep shaping the parts that are not ready yet.",
      href: advancedHref,
    };
  }
  return {
    title: "Configure automation",
    description: "Turn your saved business setup into repeatable workflows and follow-ups.",
    href: automationHref,
  };
}

export function buildLaunchCenterView(input: Readonly<{
  projectId: string;
  sections: readonly LaunchCenterSection[];
  publication: LaunchCenterPublication;
  socialConnections: readonly LaunchCenterSocialConnection[];
}>): LaunchCenterView {
  const previewHref = withProjectId("/business-preview", input.projectId);
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
      continueSetup: advancedHref(input.projectId),
    },
    autopilot: [
      { label: "Brand", status: brandStatus },
      { label: "Website", status: websiteStatus },
      { label: "SEO", status: seoStatus },
      { label: "Marketing", status: marketingStatus },
      { label: "Sales", status: salesStatus },
      { label: "Social", status: socialStatus },
    ],
    nextStep,
  };
}

function advancedHref(projectId: string) {
  return withProjectId("/master-workspace#advanced-tools", projectId);
}
