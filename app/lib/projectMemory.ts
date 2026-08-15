export type ProjectMemory = {
  id: string;
  userId: string;
  name: string;
  companyName: string;
  businessDescription: string;
  originalBrief: string;
  industry: string;
  goal: string;
  brandStyle?: string;
  location: string;
  businessStage: string;
  targetAudience: string;
  result: string;
  context: string;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function normalizeProjectMemory(value: unknown): ProjectMemory {
  const project = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  const originalBrief = text(project.originalBrief);
  const storedDescription = text(project.businessDescription ?? project.brandDescription);

  return {
    id: text(project.id),
    userId: text(project.userId),
    name: text(project.name),
    companyName: text(project.companyName),
    businessDescription: originalBrief || storedDescription,
    originalBrief,
    industry: text(project.industry),
    goal: text(project.goal),
    brandStyle: text(project.brandStyle),
    location: text(project.location),
    businessStage: text(project.businessStage),
    targetAudience: text(project.targetAudience),
    result: text(project.result),
    context: text(project.context ?? project.analyticsContext),
  };
}
