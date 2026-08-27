import { and, asc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const FINISH_SALES_PROJECT_ID = "ad98e057-4fe9-4394-97bc-05391efb85d3";
export const FINISH_SALES_RUN_ID = "319cbe1c-efa0-4288-b644-48fd92b48b9e";

type Run = Pick<typeof easyModeRuns.$inferSelect, "id" | "projectId" | "userId" | "status">;
type Task = Pick<typeof easyModeTasks.$inferSelect, "moduleId" | "position" | "status">;
type Dependencies = Readonly<{
  verify: typeof verifyFirebaseIdToken;
  isBoss: typeof isBossAdmin;
  read: () => Promise<{ run: Run | null; tasks: Task[] }>;
}>;

export function validateSalesOnlyState(run: Run | null, tasks: readonly Task[], userId: string) {
  if (!run || run.id !== FINISH_SALES_RUN_ID || run.projectId !== FINISH_SALES_PROJECT_ID || run.userId !== userId || run.status !== "running") return null;
  const sales = tasks.filter((task) => task.moduleId === "sales");
  const completed = tasks.filter((task) => task.status === "completed");
  const unexpectedActive = tasks.filter((task) => task.moduleId !== "sales" && ["queued", "running"].includes(task.status));
  if (tasks.length !== 7 || sales.length !== 1 || sales[0].status !== "queued" ||
      completed.length !== 6 || unexpectedActive.length > 0 || tasks.some((task) => task.moduleId !== "sales" && task.status !== "completed")) return null;
  return Object.freeze({
    valid: true as const, projectId: run.projectId, runId: run.id, runStatus: "running" as const,
    salesStatus: "queued" as const, completedTasks: 6 as const, providerCallsOnRun: 1 as const,
  });
}

async function readFixedSalesState() {
  const [runs, tasks] = await Promise.all([
    db.select({ id: easyModeRuns.id, projectId: easyModeRuns.projectId, userId: easyModeRuns.userId, status: easyModeRuns.status })
      .from(easyModeRuns).where(and(eq(easyModeRuns.id, FINISH_SALES_RUN_ID), eq(easyModeRuns.projectId, FINISH_SALES_PROJECT_ID))).limit(1),
    db.select({ moduleId: easyModeTasks.moduleId, position: easyModeTasks.position, status: easyModeTasks.status })
      .from(easyModeTasks).where(eq(easyModeTasks.runId, FINISH_SALES_RUN_ID)).orderBy(asc(easyModeTasks.position)),
  ]);
  return { run: runs[0] ?? null, tasks };
}

const defaultDependencies: Dependencies = { verify: verifyFirebaseIdToken, isBoss: isBossAdmin, read: readFixedSalesState };

export async function handleFinishSalesValidation(request: Request, dependencies: Dependencies = defaultDependencies) {
  let uid: string;
  try { uid = (await dependencies.verify(request)).uid; }
  catch { return Response.json({ error: "Not found." }, { status: 404 }); }
  if (!dependencies.isBoss(uid)) return Response.json({ error: "Not found." }, { status: 404 });
  const { run, tasks } = await dependencies.read();
  const result = validateSalesOnlyState(run, tasks, uid);
  if (!result) return Response.json({ error: "Sales-only preconditions are not satisfied." }, { status: 409 });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = (request: Request) => handleFinishSalesValidation(request);
