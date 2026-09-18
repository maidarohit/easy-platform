export type PublicationKind = "business" | "website";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function trafficCampaign(value: unknown): string | null {
  // Campaign codes only: reject URLs, emails, free text and phone-like numbers.
  return typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && value.replace(/\D/g, '').length < 7 ? value.toLowerCase() : null;
}
export function trafficReferrer(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin.length > 255) return null;
    // Do not retain literal IP addresses or local hostnames.
    if (!url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return url.origin;
  } catch { return null; }
}
export function parseWebsiteTraffic(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const allowed = ['eventId','kind','slug','pagePath','visitorId','sessionId','referrer','utm_source','utm_medium','utm_campaign'];
  if (Object.keys(v).some((key) => !allowed.includes(key))) return null;
  if (v.kind !== 'business' && v.kind !== 'website') return null;
  if (typeof v.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug) || v.slug.length > 63) return null;
  if (typeof v.pagePath !== 'string' || v.pagePath.length > 256 || !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/.test(v.pagePath)) return null;
  if (![v.eventId, v.visitorId, v.sessionId].every((id) => typeof id === 'string' && UUID.test(id))) return null;
  return { eventId: v.eventId as string, kind: v.kind, slug: v.slug, pagePath: v.pagePath,
    visitorId: v.visitorId as string, sessionId: v.sessionId as string,
    referrerOrigin: trafficReferrer(v.referrer), utmSource: trafficCampaign(v.utm_source),
    utmMedium: trafficCampaign(v.utm_medium), utmCampaign: trafficCampaign(v.utm_campaign) };
}
export type WebsiteTrafficEvent = NonNullable<ReturnType<typeof parseWebsiteTraffic>>;
export function websiteTrafficIdentity(storage: Pick<Storage, 'getItem' | 'setItem'>, sessions: Pick<Storage, 'getItem' | 'setItem'>,
  site: string, entry: { referrer: string; search: string; origin: string }, now = Date.now(), uuid = () => crypto.randomUUID()) {
  const key = `buzypeezy:website-traffic:${site}`;
  let visitorId = storage.getItem(`${key}:visitor`);
  if (!visitorId || !UUID.test(visitorId)) { visitorId = uuid(); storage.setItem(`${key}:visitor`, visitorId); }
  let session;
  try { session = JSON.parse(sessions.getItem(`${key}:session`) || 'null'); } catch { session = null; }
  if (!session || !UUID.test(session.id) || !Number.isFinite(session.lastSeen) || now < session.lastSeen || now - session.lastSeen > 30 * 60 * 1000) {
    const query = new URLSearchParams(entry.search);
    const referrer = trafficReferrer(entry.referrer);
    session = { id: uuid(), referrer: referrer === entry.origin ? null : referrer,
      source: trafficCampaign(query.get('utm_source')), medium: trafficCampaign(query.get('utm_medium')), campaign: trafficCampaign(query.get('utm_campaign')) };
  }
  session.lastSeen = now;
  sessions.setItem(`${key}:session`, JSON.stringify(session));
  return { visitorId, sessionId: session.id as string, referrer: trafficReferrer(session.referrer),
    utm_source: trafficCampaign(session.source), utm_medium: trafficCampaign(session.medium), utm_campaign: trafficCampaign(session.campaign) };
}
export type TrafficRanking = { label: string; count: number }[];
export type WebsiteTrafficReport = {
  timezone: string; visitorsToday: number; pageViewsToday: number;
  visitors7Days: number; visitors30Days: number; pageViews7Days: number; pageViews30Days: number;
  daily: { day: string; visitors: number; pageViews: number }[];
  periods: Record<'7' | '30', { pages: TrafficRanking; referrers: TrafficRanking; sources: TrafficRanking }>;
};
