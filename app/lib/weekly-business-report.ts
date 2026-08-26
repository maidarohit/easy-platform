export const REPORT_TIMEZONE = "UTC";

export type ReportWeek = "current" | "previous";

export function weeklyReportWindow(now = new Date(), week: ReportWeek = "current") {
  const day = now.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday - (week === "previous" ? 7 : 0)));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export type WeeklyReportFacts = Readonly<{
  projectName: string;
  dnaConfirmed: boolean;
  latestRunStatus: string | null;
  outputModules: readonly string[];
  outputActivity: readonly string[];
  previewApproved: boolean;
  publicationStatus: "active" | "inactive" | "unpublished";
  socialCounts: Readonly<Record<string, number>>;
  connectedSocialChannels: number;
  todaysSocialStatus: string | null;
  aiRequestCount: number;
  subscriptionStatus: string | null;
}>;

const moduleLabels: Readonly<Record<string, string>> = {
  "ai-manager": "Business direction", branding: "Brand", website: "Website", marketing: "Marketing",
  seo: "Search", uiux: "Customer experience", sales: "Sales foundation", logo: "Logo", content: "Content", analytics: "Analytics",
};

export function buildWeeklyBusinessReport(facts: WeeklyReportFacts, week: ReportWeek) {
  const completedActions = facts.outputActivity.map((module) => `${moduleLabels[module] ?? "Business"} output saved`);
  if (facts.socialCounts.approved) completedActions.push(`${facts.socialCounts.approved} social recommendation${facts.socialCounts.approved === 1 ? "" : "s"} approved`);
  if (facts.socialCounts.skipped) completedActions.push(`${facts.socialCounts.skipped} social recommendation${facts.socialCounts.skipped === 1 ? "" : "s"} skipped`);
  if (facts.socialCounts.published) completedActions.push(`${facts.socialCounts.published} social post${facts.socialCounts.published === 1 ? "" : "s"} published`);

  const attention: string[] = [];
  const nextActions: Array<{ label: string; href: string }> = [];
  if (!facts.dnaConfirmed) {
    attention.push("Business details are not confirmed yet.");
    nextActions.push({ label: "Review your business details", href: "/onboarding" });
  } else if (facts.outputModules.length > 0 && !facts.previewApproved) {
    attention.push("Your business preview is ready for review.");
    nextActions.push({ label: "Review your business", href: "/business-preview" });
  } else if (facts.previewApproved && facts.publicationStatus !== "active") {
    attention.push("Your approved business preview is not published.");
    nextActions.push({ label: "Publish your business", href: "/business-preview" });
  }
  if (facts.connectedSocialChannels === 0) {
    attention.push("No social channel is connected.");
    nextActions.push({ label: "Connect a social channel", href: "/social" });
  }
  if (week === "current" && facts.todaysSocialStatus === "proposed") {
    attention.push("Today’s social recommendation is waiting for review.");
    nextActions.push({ label: "Review today’s post", href: "/social" });
  }

  return {
    summary: {
      business: facts.projectName,
      businessDna: facts.dnaConfirmed ? "Confirmed" : "Not confirmed",
      buildStatus: facts.latestRunStatus ?? "Not started",
      savedOutputs: facts.outputModules.length,
      preview: facts.outputModules.length === 0 ? "Not available yet" : facts.previewApproved ? "Approved" : "Needs review",
      publication: facts.publicationStatus === "active" ? "Published" : facts.publicationStatus === "inactive" ? "Not currently published" : "Not published",
      aiRequests: facts.aiRequestCount,
      subscription: facts.subscriptionStatus ?? "Not subscribed",
    },
    completedActions,
    attention,
    nextActions,
    empty: facts.outputActivity.length === 0 && Object.values(facts.socialCounts).every((count) => count === 0) && facts.aiRequestCount === 0,
  };
}
