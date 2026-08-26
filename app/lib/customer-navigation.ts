export type CustomerProject = Readonly<{
  id: string;
  companyName?: string | null;
  industry?: string | null;
  goal?: string | null;
  originalBrief?: string | null;
}>;

export function customerProjectAction(project: CustomerProject) {
  const hasBusinessContext = [project.companyName, project.industry, project.goal, project.originalBrief]
    .some((value) => typeof value === "string" && value.trim().length > 0);
  return hasBusinessContext
    ? { label: "Open My Business", href: `/master-workspace?projectId=${encodeURIComponent(project.id)}` }
    : { label: "Tell us about your business", href: `/onboarding?projectId=${encodeURIComponent(project.id)}` };
}
