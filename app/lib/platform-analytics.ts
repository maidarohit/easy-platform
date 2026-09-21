export const ANONYMOUS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VISITOR_KEY = "buzypeezy:anonymous-visitor";
export const REPORTING_TIMEZONE = "Asia/Kolkata";

export function persistentVisitorId(storage: Pick<Storage, "getItem" | "setItem">, randomUUID = () => crypto.randomUUID()): string {
  const existing = storage.getItem(VISITOR_KEY);
  if (existing && ANONYMOUS_UUID.test(existing)) return existing;
  const id = randomUUID();
  storage.setItem(VISITOR_KEY, id);
  return id;
}

export function reportingWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: REPORTING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  // Kolkata uses UTC+05:30 year-round. Convert its calendar midnight to a UTC instant.
  const today = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00+05:30`);
  const day = 24 * 60 * 60 * 1000;
  return { today, sevenDays: new Date(today.getTime() - 6 * day), thirtyDays: new Date(today.getTime() - 29 * day), end: now };
}

export function parsePageView(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.sessionId !== "string" || !ANONYMOUS_UUID.test(body.sessionId)) return null;
  if (typeof body.visitorId !== "string" || !ANONYMOUS_UUID.test(body.visitorId)) return null;
  if (typeof body.pathname !== "string" || body.pathname.length > 1024 || !body.pathname.startsWith("/") || /[?#\\\s\u0000-\u001f]/.test(body.pathname) || body.pathname.startsWith("//")) return null;
  if (/^\/(admin|boss|api|prospect-preview)(\/|$)/.test(body.pathname)) return null;
  const campaign = (key: string) => {
    const value = body[key];
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || null : null;
  };
  let referrer: string | null = null;
  if (typeof body.referrer === "string" && body.referrer) {
    try {
      const url = new URL(body.referrer);
      if (["https:", "http:"].includes(url.protocol) && url.origin.length <= 255) referrer = url.origin;
    } catch { /* Invalid referrers are omitted. */ }
  }
  return { visitorId: body.visitorId, sessionId: body.sessionId, pathname: body.pathname, referrer,
    utmSource: campaign("utm_source"), utmMedium: campaign("utm_medium"), utmCampaign: campaign("utm_campaign") };
}

export type PlatformAnalyticsSummary = {
  visitorsToday: number;
  pageViewsToday: number;
  visitors7Days: number;
  visitors30Days: number;
  topSources: Array<{ label: string; count: number }>;
  topPages: Array<{ label: string; count: number }>;
};
