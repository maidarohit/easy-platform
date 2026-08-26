import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projectBusinessDna, projectOutputs, projects } from "@/app/db/schema";
import type { BusinessDnaContent } from "@/app/lib/business-dna";
import { projectBusinessDnaToProjectMemory } from "@/app/lib/business-dna";
import { getModuleAdapter } from "@/app/lib/easy-mode-execution-contracts";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { customerTaskViews, type EasyModeCustomerTask } from "@/app/lib/easy-mode-customer-status";

export const WORKSPACE_MODULES = [
  "branding", "logo", "content", "website", "marketing",
  "seo", "uiux", "sales", "analytics", "ai-manager",
] as const;
export type WorkspaceModule = (typeof WORKSPACE_MODULES)[number];

type WorkspaceProjectSource = Readonly<{
  id: string;
  name: string;
  companyName: string | null;
  industry: string | null;
  goal: string | null;
  originalBrief: string | null;
  brandDescription: string | null;
}>;

export function workspaceProjectPresentation(
  project: WorkspaceProjectSource,
  confirmedDna: BusinessDnaContent | null,
) {
  const projection = confirmedDna ? projectBusinessDnaToProjectMemory(confirmedDna) : null;
  const canonicalGoal = confirmedDna?.goals?.primaryGoal?.trim() ||
    confirmedDna?.goals?.sixToTwelveMonthGoal?.trim() ||
    confirmedDna?.goals?.primaryLeadObjective?.trim() ||
    confirmedDna?.goals?.vision?.trim();
  return {
    id: project.id,
    name: projection?.businessName || project.companyName?.trim() || project.name,
    companyName: projection?.businessName || project.companyName?.trim() || null,
    industry: projection?.industry || project.industry?.trim() || null,
    goal: canonicalGoal || project.goal?.trim() || null,
    businessDescription: projection?.businessDescription || project.originalBrief?.trim() ||
      project.brandDescription?.trim() || null,
  };
}

export function workspaceSectionState(
  hasOutput: boolean,
  customerState?: EasyModeCustomerTask["customerState"],
) {
  if (customerState === "Failed" || customerState === "Needs attention") return customerState;
  if (customerState === "Waiting" || customerState === "In progress") return "In progress";
  return hasOutput ? "Ready" : "Not generated";
}

export const MODULE_ALIASES: Readonly<Record<string, WorkspaceModule>> = {
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

export function validatedWorkspaceOutput(module: WorkspaceModule, result: string) {
  try {
    return getModuleAdapter(module)?.validateOutput?.(JSON.parse(result)) ?? null;
  } catch {
    return null;
  }
}

export function selectLatestWorkspaceOutputs(
  rows: readonly Readonly<{ id?: string; module: string; result: string; approvedAt?: Date | null }>[]
) {
  const latest = new Map<WorkspaceModule, Readonly<{
    id: string | null;
    output: Readonly<Record<string, unknown>>;
    approvedAt: Date | null;
  }>>();
  for (const row of rows) {
    const moduleId = MODULE_ALIASES[row.module.toLowerCase()];
    if (!moduleId || latest.has(moduleId)) continue;
    const output = validatedWorkspaceOutput(moduleId, row.result);
    if (output) latest.set(moduleId, {
      id: row.id ?? null,
      output,
      approvedAt: row.approvedAt ?? null,
    });
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

  const [dnaRow] = await db.select({ dna: projectBusinessDna.dna }).from(projectBusinessDna).where(and(
    eq(projectBusinessDna.projectId, projectId),
    eq(projectBusinessDna.userId, userId),
    eq(projectBusinessDna.confirmed, true),
  )).limit(1);

  const outputs = await db.select().from(projectOutputs).where(and(
    eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId),
  )).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt));
  const latest = selectLatestWorkspaceOutputs(outputs);

  const [latestRun] = await db.select({ id: easyModeRuns.id }).from(easyModeRuns).where(and(
    eq(easyModeRuns.projectId, projectId), eq(easyModeRuns.userId, userId),
  )).orderBy(desc(easyModeRuns.createdAt)).limit(1);
  const taskStatuses = new Map<string, EasyModeCustomerTask>();
  if (latestRun) {
    const tasks = await db.select().from(easyModeTasks).where(eq(easyModeTasks.runId, latestRun.id));
    const customerTasks = await customerTaskViews(latestRun.id, tasks);
    for (const task of customerTasks) taskStatuses.set(task.moduleId, task);
  }

  return Response.json({
    project: workspaceProjectPresentation(project, dnaRow?.dna ?? null),
    sections: WORKSPACE_MODULES.map((module) => {
      const task = taskStatuses.get(module);
      const failedState = task?.customerState === "Failed" || task?.customerState === "Needs attention";
      return {
        module,
        state: workspaceSectionState(latest.has(module), task?.customerState),
        outputId: latest.get(module)?.id ?? null,
        output: latest.get(module)?.output ?? null,
        approvedAt: latest.get(module)?.approvedAt?.toISOString() ?? null,
        reviewState: latest.has(module)
          ? latest.get(module)?.approvedAt ? "Approved" : "Needs review"
          : null,
        executionMessage: failedState ? task.customerMessage : null,
        canRetry: failedState ? task.canRetry : false,
        retryRunId: failedState ? latestRun?.id ?? null : null,
        retryTaskId: failedState ? task.id : null,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
