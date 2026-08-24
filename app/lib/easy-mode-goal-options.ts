export const EASY_MODE_GOALS = [
  { id: "build_everything", label: "Build everything" },
  { id: "build_website", label: "Build my website" },
  { id: "get_customers", label: "Get customers" },
  { id: "build_brand", label: "Build my brand" },
  { id: "create_content", label: "Create content" },
  { id: "improve_business", label: "Improve my business" },
] as const;

export type EasyModeGoalId = (typeof EASY_MODE_GOALS)[number]["id"];

const LEGACY_GOAL_MAP: Record<string, EasyModeGoalId> = {
  "build my business": "build_everything",
  "get more customers": "get_customers",
  "improve my online presence": "build_website",
  "increase sales": "get_customers",
  "launch something new": "build_everything",
  "i'm not sure — guide me": "improve_business",
  "i'm not sure â€” guide me": "improve_business",
  "guide me": "improve_business",
};

export function isEasyModeGoalId(value: unknown): value is EasyModeGoalId {
  return typeof value === "string" && EASY_MODE_GOALS.some((goal) => goal.id === value);
}

export function mapExistingGoal(value: unknown): EasyModeGoalId {
  if (isEasyModeGoalId(value)) return value;
  if (typeof value !== "string") return "improve_business";
  return LEGACY_GOAL_MAP[value.trim().toLowerCase()] || "improve_business";
}
