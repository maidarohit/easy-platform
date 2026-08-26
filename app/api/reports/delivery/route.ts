import { and, desc, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects, weeklyReportDeliveries, weeklyReportPreferences } from "@/app/db/schema";
import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { getFirebaseDeliveryIdentity, verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { absoluteWeeklyReportUrl, weeklyDeliveryConfiguration } from "@/app/lib/weekly-report-delivery";
import { nextWeeklyDeliveryAt } from "@/app/lib/weekly-business-report";

async function owner(request: Request, projectId: string) { const token = await verifyFirebaseIdToken(request); const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, token.uid))).limit(1); return project ? token.uid : null; }
const mask = (value: string | null) => !value ? null : value.includes("@") ? value.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : `${value.slice(0, 3)}••••${value.slice(-3)}`;

export async function GET(request: Request) {
  try {
    const projectId = validateEasyModeProjectId(new URL(request.url).searchParams.get("projectId"));
    if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
    const userId = await owner(request, projectId); if (!userId) return Response.json({ error: "Project not found." }, { status: 404 });
    const [identity, preferences, deliveries] = await Promise.all([getFirebaseDeliveryIdentity(userId), db.select().from(weeklyReportPreferences).where(and(eq(weeklyReportPreferences.projectId, projectId), eq(weeklyReportPreferences.userId, userId))).limit(1), db.select().from(weeklyReportDeliveries).where(and(eq(weeklyReportDeliveries.projectId, projectId), eq(weeklyReportDeliveries.userId, userId))).orderBy(desc(weeklyReportDeliveries.weekStart), desc(weeklyReportDeliveries.updatedAt))]);
    const config = weeklyDeliveryConfiguration(); const preference = preferences[0]; const last = (channel: "email" | "whatsapp") => deliveries.find((item) => item.channel === channel) ?? null;
    const reportUrl = absoluteWeeklyReportUrl(projectId);
    if (!reportUrl) return Response.json({ error: "Canonical application URL is not configured." }, { status: 503 });
    return Response.json({ enabled: preference?.enabled ?? true, schedule: "Every Monday at 9:00 AM IST", nextDeliveryAt: nextWeeklyDeliveryAt().toISOString(), reportUrl, email: { destination: mask(identity.email), readiness: identity.email && config.email ? "ready" : "needs_attention", last: last("email") }, whatsapp: { destination: mask(identity.phoneNumber), readiness: identity.phoneNumber && preference?.whatsappOptInAt && config.whatsapp ? "ready" : "setup_required", last: last("whatsapp") } });
  } catch { return Response.json({ error: "Weekly delivery setup requires the pending database migration." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join(",") !== "enabled,projectId") return Response.json({ error: "Invalid delivery preference." }, { status: 400 });
    const value = body as { projectId?: unknown; enabled?: unknown }; const projectId = validateEasyModeProjectId(value.projectId);
    if (!projectId || typeof value.enabled !== "boolean") return Response.json({ error: "Invalid delivery preference." }, { status: 400 });
    const userId = await owner(request, projectId); if (!userId) return Response.json({ error: "Project not found." }, { status: 404 });
    await db.insert(weeklyReportPreferences).values({ projectId, userId, enabled: value.enabled }).onConflictDoUpdate({ target: weeklyReportPreferences.projectId, set: { enabled: value.enabled, updatedAt: new Date() } });
    return Response.json({ enabled: value.enabled });
  } catch { return Response.json({ error: "Unable to update weekly delivery." }, { status: 503 }); }
}
