import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects, weeklyReportDeliveries, weeklyReportPreferences, type WeeklyReportDeliveryChannel } from "@/app/db/schema";
import { getFirebaseDeliveryIdentity } from "@/app/lib/firebase-admin";
import { loadWeeklyReport } from "@/app/lib/weekly-report-data";
import { sendWeeklyEmail, sendWeeklyWhatsapp, weeklyDeliveryConfiguration, weeklyReportMessage } from "@/app/lib/weekly-report-delivery";
import { weeklyReportWindow } from "@/app/lib/weekly-business-report";

function authorized(request: Request) { const secret = process.env.CRON_SECRET; return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`); }
function appOrigin() { try { const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? ""); return url.protocol === "https:" ? url.origin : null; } catch { return null; } }
const failureCode = (error: unknown) => error instanceof Error ? error.message.slice(0, 64).replace(/[^A-Z0-9_]/gi, "_") : "DELIVERY_FAILED";

async function deliverChannel(input: { channel: WeeklyReportDeliveryChannel; projectId: string; userId: string; weekStart: string; send: () => Promise<string> }) {
  const [existing] = await db.select().from(weeklyReportDeliveries).where(and(eq(weeklyReportDeliveries.projectId, input.projectId), eq(weeklyReportDeliveries.weekStart, input.weekStart), eq(weeklyReportDeliveries.channel, input.channel))).limit(1);
  if (existing?.status === "delivered" || existing?.status === "pending") return existing.status;
  const claimed = existing
    ? await db.update(weeklyReportDeliveries).set({ status: "pending", failureCode: null, updatedAt: new Date() }).where(and(eq(weeklyReportDeliveries.id, existing.id), eq(weeklyReportDeliveries.status, "failed"))).returning({ id: weeklyReportDeliveries.id })
    : await db.insert(weeklyReportDeliveries).values({ projectId: input.projectId, userId: input.userId, weekStart: input.weekStart, channel: input.channel, status: "pending" }).onConflictDoNothing({ target: [weeklyReportDeliveries.projectId, weeklyReportDeliveries.weekStart, weeklyReportDeliveries.channel] }).returning({ id: weeklyReportDeliveries.id });
  if (claimed.length === 0) return "pending";
  const attemptedAt = new Date();
  try {
    const providerMessageId = await input.send();
    await db.update(weeklyReportDeliveries).set({ status: "delivered", attemptedAt, deliveredAt: new Date(), failureCode: null, providerMessageId, updatedAt: new Date() }).where(and(eq(weeklyReportDeliveries.projectId, input.projectId), eq(weeklyReportDeliveries.weekStart, input.weekStart), eq(weeklyReportDeliveries.channel, input.channel), eq(weeklyReportDeliveries.status, "pending")));
    return "delivered";
  } catch (error) {
    await db.update(weeklyReportDeliveries).set({ status: "failed", attemptedAt, deliveredAt: null, failureCode: failureCode(error), providerMessageId: null, updatedAt: new Date() }).where(and(eq(weeklyReportDeliveries.projectId, input.projectId), eq(weeklyReportDeliveries.weekStart, input.weekStart), eq(weeklyReportDeliveries.channel, input.channel), eq(weeklyReportDeliveries.status, "pending")));
    return "failed";
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const origin = appOrigin(); if (!origin) return Response.json({ error: "Weekly report origin is not configured." }, { status: 503 });
  const config = weeklyDeliveryConfiguration(); const now = new Date(); const weekStart = weeklyReportWindow(now, "previous").startDate;
  const allProjects = await db.select({ id: projects.id, userId: projects.userId }).from(projects);
  const results = [];
  for (const project of allProjects) {
    const [preference] = await db.select().from(weeklyReportPreferences).where(and(eq(weeklyReportPreferences.projectId, project.id), eq(weeklyReportPreferences.userId, project.userId))).limit(1);
    if (preference?.enabled === false) { results.push({ projectId: project.id, status: "disabled" }); continue; }
    const [report, identity] = await Promise.all([loadWeeklyReport(project.userId, project.id, "previous", now), getFirebaseDeliveryIdentity(project.userId)]);
    if (!report) continue;
    const viewUrl = `${origin}/reports?projectId=${encodeURIComponent(project.id)}`; const message = weeklyReportMessage(report, viewUrl);
    const email = identity.email && config.email ? await deliverChannel({ channel: "email", projectId: project.id, userId: project.userId, weekStart, send: () => sendWeeklyEmail(identity.email!, `Weekly Business Report — ${report.summary.business}`, message) }) : "setup_required";
    const whatsapp = identity.phoneNumber && preference?.whatsappOptInAt && config.whatsapp ? await deliverChannel({ channel: "whatsapp", projectId: project.id, userId: project.userId, weekStart, send: () => sendWeeklyWhatsapp(identity.phoneNumber!, message) }) : "setup_required";
    results.push({ projectId: project.id, email, whatsapp });
  }
  return Response.json({ weekStart, processed: results.length, results });
}
