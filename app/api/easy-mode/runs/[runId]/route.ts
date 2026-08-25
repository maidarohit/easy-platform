import { and, asc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { easyModeRuns, easyModeTasks, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { validateEasyModeRunId } from "@/app/lib/easy-mode-run-validation";
import { customerTaskViews } from "@/app/lib/easy-mode-customer-status";

type RunContext = { params: Promise<{ runId: string }> };

export async function GET(request: Request, { params }: RunContext) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const runId = validateEasyModeRunId((await params).runId);
  if (!runId) return Response.json({ error: "Invalid build." }, { status: 400 });

  const [run] = await db.select().from(easyModeRuns)
    .where(and(eq(easyModeRuns.id, runId), eq(easyModeRuns.userId, userId))).limit(1);
  if (!run) return Response.json({ error: "Business build not found." }, { status: 404 });
  const [ownedProject] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, run.projectId), eq(projects.userId, userId))).limit(1);
  if (!ownedProject) return Response.json({ error: "Business build not found." }, { status: 404 });

  const tasks = await db.select().from(easyModeTasks)
    .where(eq(easyModeTasks.runId, run.id)).orderBy(asc(easyModeTasks.position));
  const customerTasks = await customerTaskViews(run.id, tasks);

  return Response.json({
    run: { id: run.id, projectId: run.projectId, goalId: run.goalId, status: run.status, createdAt: run.createdAt, startedAt: run.startedAt, completedAt: run.completedAt, failedAt: run.failedAt },
    tasks: customerTasks,
    progress: { total: tasks.length, queued: tasks.filter((task) => task.status === "queued").length, running: tasks.filter((task) => task.status === "running").length, completed: tasks.filter((task) => task.status === "completed").length, failed: tasks.filter((task) => task.status === "failed").length, skipped: tasks.filter((task) => task.status === "skipped").length },
  });
}
