import { validateEasyModeProjectId } from "@/app/lib/easy-mode-run-validation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import type { ReportWeek } from "@/app/lib/weekly-business-report";
import { loadWeeklyReport } from "@/app/lib/weekly-report-data";

export async function GET(request: Request) {
  let userId: string;
  try { userId = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  const url = new URL(request.url);
  const projectId = validateEasyModeProjectId(url.searchParams.get("projectId"));
  const week: ReportWeek = url.searchParams.get("week") === "previous" ? "previous" : "current";
  if (!projectId) return Response.json({ error: "Invalid project." }, { status: 400 });
  const report = await loadWeeklyReport(userId, projectId, week);
  if (!report) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
