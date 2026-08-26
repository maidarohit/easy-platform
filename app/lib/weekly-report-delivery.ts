import "server-only";
import type { buildWeeklyBusinessReport } from "@/app/lib/weekly-business-report";

type Report = ReturnType<typeof buildWeeklyBusinessReport> & { period: { start: string; end: string }; social: Record<string, number> };

export function weeklyReportMessage(report: Report, fullReportUrl: string) {
  const completed = report.completedActions.length ? report.completedActions.slice(0, 4).map((item) => `• ${item}`).join("\n") : "• No completed activity recorded";
  const attention = report.attention.length ? report.attention.slice(0, 4).map((item) => `• ${item}`).join("\n") : "• Nothing needs immediate attention";
  const actions = report.nextActions.length ? report.nextActions.slice(0, 4).map((item) => `• ${item.label}`).join("\n") : "• Keep reviewing your weekly activity";
  return `Weekly Business Report\n${report.period.start.slice(0, 10)} to ${report.period.end.slice(0, 10)}\n\nCompleted\n${completed}\n\nNeeds attention\n${attention}\n\nPublication: ${report.summary.publication}\nSocial: ${report.social.approved ?? 0} approved, ${report.social.proposed ?? 0} proposed, ${report.social.skipped ?? 0} skipped, ${report.social.published ?? 0} published\n\nNext actions\n${actions}\n\nView Full Report: ${fullReportUrl}`;
}

export function weeklyDeliveryConfiguration() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.WEEKLY_REPORT_FROM_EMAIL),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  };
}

export async function sendWeeklyEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WEEKLY_REPORT_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text }) });
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof result?.id !== "string") throw new Error("EMAIL_PROVIDER_REJECTED");
  return result.id;
}

export async function sendWeeklyWhatsapp(to: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_PROVIDER_NOT_CONFIGURED");
  const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } }) });
  const result = await response.json().catch(() => null) as { messages?: Array<{ id?: unknown }> } | null;
  const id = result?.messages?.[0]?.id;
  if (!response.ok || typeof id !== "string") throw new Error("WHATSAPP_PROVIDER_REJECTED");
  return id;
}
