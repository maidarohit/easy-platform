import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, businessPublications, easyModeRuns, projectBusinessDna, projectOutputs, projects, projectPreviewCustomizations, socialConnections, socialDailyPosts, subscriptions } from "@/app/db/schema";
import { BUSINESS_PREVIEW_MODULES } from "@/app/lib/business-preview";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { buildWeeklyBusinessReport, REPORT_TIMEZONE, type ReportWeek, weeklyReportWindow } from "@/app/lib/weekly-business-report";

export async function GET(request: Request) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }

  const url = new URL(request.url);
  const projectId = validateEasyModeProjectId(url.searchParams.get("projectId"));
  const week: ReportWeek = url.searchParams.get("week") === "previous" ? "previous" : "current";
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });

  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const window = weeklyReportWindow(new Date(), week);
  const [dnaRows, outputs, runs, publicationRows, customizationRows, socialRows, connections, usageRows, subscriptionRows] = await Promise.all([
    db.select().from(projectBusinessDna).where(and(eq(projectBusinessDna.projectId, projectId), eq(projectBusinessDna.userId, userId))).limit(1),
    db.select().from(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId))).orderBy(desc(projectOutputs.updatedAt), desc(projectOutputs.createdAt)),
    db.select().from(easyModeRuns).where(and(eq(easyModeRuns.projectId, projectId), eq(easyModeRuns.userId, userId))).orderBy(desc(easyModeRuns.createdAt)),
    db.select().from(businessPublications).where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, userId))).limit(1),
    db.select().from(projectPreviewCustomizations).where(and(eq(projectPreviewCustomizations.projectId, projectId), eq(projectPreviewCustomizations.userId, userId))).limit(1),
    db.select().from(socialDailyPosts).where(and(eq(socialDailyPosts.projectId, projectId), eq(socialDailyPosts.userId, userId), gte(socialDailyPosts.localDate, window.startDate), lt(socialDailyPosts.localDate, window.endDate))),
    db.select().from(socialConnections).where(and(eq(socialConnections.projectId, projectId), eq(socialConnections.userId, userId), eq(socialConnections.status, "connected"))),
    db.select({ requestCount: aiUsage.requestCount }).from(aiUsage).where(and(eq(aiUsage.projectId, projectId), eq(aiUsage.userId, userId), gte(aiUsage.createdAt, window.start), lt(aiUsage.createdAt, window.end))),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt)).limit(1),
  ]);

  const dna = dnaRows[0];
  const latestOutputs = selectLatestWorkspaceOutputs(outputs);
  const previewOutputs = BUSINESS_PREVIEW_MODULES.map((module) => latestOutputs.get(module)).filter(Boolean);
  const hasOverrides = Object.keys(customizationRows[0]?.overrides ?? {}).length > 0;
  const previewApproved = previewOutputs.length > 0 && (hasOverrides
    ? Boolean(customizationRows[0]?.approvedAt)
    : previewOutputs.every((output) => Boolean(output?.approvedAt)));
  const socialCounts = { proposed: 0, approved: 0, skipped: 0, published: 0, failed: 0 };
  for (const post of socialRows) socialCounts[post.status] += 1;
  const today = new Date().toISOString().slice(0, 10);
  const latestRun = runs[0];
  const report = buildWeeklyBusinessReport({
    projectName: workspaceProjectPresentation(project, dna?.confirmed ? dna.dna : null).name,
    dnaConfirmed: Boolean(dna?.confirmed),
    latestRunStatus: latestRun?.status ?? null,
    outputModules: [...latestOutputs.keys()],
    outputActivity: outputs.filter((output) => output.createdAt >= window.start && output.createdAt < window.end).map((output) => output.module),
    previewApproved,
    publicationStatus: publicationRows[0]?.status ?? "unpublished",
    socialCounts,
    connectedSocialChannels: connections.length,
    todaysSocialStatus: socialRows.find((post) => post.localDate === today)?.status ?? null,
    aiRequestCount: usageRows.reduce((total, row) => total + row.requestCount, 0),
    subscriptionStatus: subscriptionRows[0]?.status ?? null,
  }, week);

  const withProject = report.nextActions.map((action) => ({ ...action, href: `${action.href}?projectId=${encodeURIComponent(projectId)}` }));
  return Response.json({
    projectId,
    week,
    timezone: REPORT_TIMEZONE,
    period: { start: window.start.toISOString(), end: window.end.toISOString() },
    ...report,
    nextActions: withProject,
    social: socialCounts,
  }, { headers: { "Cache-Control": "no-store" } });
}
