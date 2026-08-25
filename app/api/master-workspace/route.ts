import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projectOutputs, projects } from "@/app/db/schema";
import { getModuleAdapter } from "@/app/lib/easy-mode-execution-contracts";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";

const WORKSPACE_MODULES = [
  "branding", "logo", "content", "website", "marketing",
  "seo", "uiux", "sales", "analytics", "ai-manager",
] as const;
type WorkspaceModule = (typeof WORKSPACE_MODULES)[number];

const MODULE_ALIASES: Readonly<Record<string, WorkspaceModule>> = {
  branding: "branding", "branding-ai": "branding",
  logo: "logo", "logo-ai": "logo",
  content: "content", "content-ai": "content",
  website: "website", "website-ai": "website",
  marketing: "marketing", "marketing-ai": "marketing",
  seo: "seo", "seo-ai": "seo",
  uiux: "uiux", "uiux-ai": "uiux",
  sales: "sales", "sales-ai": "sales",
  analytics: "analytics", "analytics-ai": "analytics",
  "ai-manager": "ai-manager",
};

function validatedOutput(module: WorkspaceModule, result: string) {
  try {
    return getModuleAdapter(module)?.validateOutput?.(JSON.parse(result)) ?? null;
  } catch {
    return null;
  }
}

export function selectLatestWorkspaceOutputs(
  rows: readonly Readonly<{ module: string; result: string }>[]
) {
  const latest = new Map<WorkspaceModule, Readonly<Record<string, unknown>>>();
  for (const row of rows) {
    const moduleId = MODULE_ALIASES[row.module.toLowerCase()];
    if (!moduleId || latest.has(moduleId)) continue;
    const output = validatedOutput(moduleId, row.result);
    if (output) latest.set(moduleId, output);
  }
  return latest;
}

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const [project] = await db.select().from(projects).where(and(
    eq(projects.id, projectId), eq(projects.userId, userId),
  )).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const outputs = await db.select().from(projectOutputs).where(and(
    eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
  )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt));
  const latest = selectLatestWorkspaceOutputs(outputs);

  const [latestRun] = await db.select({ id: easyModeRuns.id }).from(easyModeRuns).where(and(
    eq(easyModeRuns.projectId, projectId), eq(easyModeRuns.userId, userId),
  )).orderBy(desc(easyModeRuns.createdAt)).limit(1);
  const taskStatuses = new Map<string, string>();
  if (latestRun) {
    const tasks = await db.select({ moduleId: easyModeTasks.moduleId, status: easyModeTasks.status })
      .from(easyModeTasks).where(eq(easyModeTasks.runId, latestRun.id));
    for (const task of tasks) taskStatuses.set(task.moduleId, task.status);
  }

  return Response.json({
    project: {
      id: project.id, name: project.name, companyName: project.companyName,
      industry: project.industry, goal: project.goal,
      businessDescription: project.originalBrief || project.brandDescription,
    },
    sections: WORKSPACE_MODULES.map((module) => ({
      module,
      state: latest.has(module) ? "Ready" :
        ["queued", "running"].includes(taskStatuses.get(module) ?? "") ? "In progress" : "Not generated",
      output: latest.get(module) ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
