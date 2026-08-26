import "server-only";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, businessPublications, easyModeRuns, projectBusinessDna, projectOutputs, projects, projectPreviewCustomizations, socialConnections, socialDailyPosts, subscriptions } from "@/app/db/schema";
import { BUSINESS_PREVIEW_MODULES } from "@/app/lib/business-preview";
import { selectLatestWorkspaceOutputs, workspaceProjectPresentation } from "@/app/api/master-workspace/route";
import { buildWeeklyBusinessReport, REPORT_TIMEZONE, type ReportWeek, weeklyReportWindow } from "@/app/lib/weekly-business-report";

export async function loadWeeklyReport(userId: string, projectId: string, week: ReportWeek, now = new Date()) {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return null;
  const window = weeklyReportWindow(now, week);
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
  const dna = dnaRows[0]; const latestOutputs = selectLatestWorkspaceOutputs(outputs);
  const previewOutputs = BUSINESS_PREVIEW_MODULES.map((module) => latestOutputs.get(module)).filter(Boolean);
  const hasOverrides = Object.keys(customizationRows[0]?.overrides ?? {}).length > 0;
  const previewApproved = previewOutputs.length > 0 && (hasOverrides ? Boolean(customizationRows[0]?.approvedAt) : previewOutputs.every((output) => Boolean(output?.approvedAt)));
  const social = { proposed: 0, approved: 0, skipped: 0, published: 0, failed: 0 };
  for (const post of socialRows) social[post.status] += 1;
  const report = buildWeeklyBusinessReport({ projectName: workspaceProjectPresentation(project, dna?.confirmed ? dna.dna : null).name, dnaConfirmed: Boolean(dna?.confirmed), latestRunStatus: runs[0]?.status ?? null, outputModules: [...latestOutputs.keys()], outputActivity: outputs.filter((output) => output.createdAt >= window.start && output.createdAt < window.end).map((output) => output.module), previewApproved, publicationStatus: publicationRows[0]?.status ?? "unpublished", socialCounts: social, connectedSocialChannels: connections.length, todaysSocialStatus: socialRows.find((post) => post.localDate === now.toISOString().slice(0, 10))?.status ?? null, aiRequestCount: usageRows.reduce((total, row) => total + row.requestCount, 0), subscriptionStatus: subscriptionRows[0]?.status ?? null }, week);
  return { projectId, week, timezone: REPORT_TIMEZONE, period: { start: window.start.toISOString(), end: window.end.toISOString() }, ...report, nextActions: report.nextActions.map((action) => ({ ...action, href: `${action.href}?projectId=${encodeURIComponent(projectId)}` })), social };
}
