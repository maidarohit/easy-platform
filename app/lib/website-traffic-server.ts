import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { projects, websitePageViews } from "@/app/db/schema";
import { loadPublishedBusiness } from "@/app/lib/public-business-publication";
import { loadActiveWebsitePublication } from "@/app/lib/public-website-publication";
import { resolvePublishedWebsitePage } from "@/app/lib/website-site-presentation";
import type { WebsiteTrafficEvent } from "@/app/lib/website-traffic";

export async function resolveTrafficPublication(event: WebsiteTrafficEvent, loaders = { business: loadPublishedBusiness, website: loadActiveWebsitePublication }) {
  if (event.kind === 'business') {
    const publication = await loaders.business(event.slug);
    if (!publication) return null;
    if (publication.snapshot.siteDocument ? !resolvePublishedWebsitePage(publication.snapshot.siteDocument, event.pagePath) : event.pagePath !== '/') return null;
    return { projectId: publication.projectId, publicationId: publication.publicationId };
  }
  const publication = await loaders.website(event.slug);
  if (!publication) return null;
  if (publication.snapshot.schemaVersion === 2 ? !resolvePublishedWebsitePage(publication.snapshot.siteDocument, event.pagePath) : event.pagePath !== '/') return null;
  return { projectId: publication.projectId, publicationId: publication.publicationId };
}

export async function recordWebsiteTraffic(event: WebsiteTrafficEvent, publication: { projectId: string; publicationId: string }, database = db) {
  return database.transaction(async (tx) => {
    // Bound even rotating sessions; serialize per publication across instances.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`website-traffic:${event.kind}:${publication.publicationId}`}))`);
    const [duplicate] = await tx.select({ id: websitePageViews.eventId }).from(websitePageViews).where(eq(websitePageViews.eventId, event.eventId)).limit(1);
    if (duplicate) return 'duplicate' as const;
    const [rate] = await tx.execute<{ total: number; session: number }>(sql`select count(*)::int as total,
      count(*) filter (where session_id = ${event.sessionId}::uuid)::int as session
      from website_page_views where publication_kind = ${event.kind} and publication_id = ${publication.publicationId}::uuid
      and created_at >= now() - interval '1 minute'`);
    if (rate.total >= 1000 || rate.session >= 60) return 'limited' as const;
    const inserted = await tx.insert(websitePageViews).values({ ...publication, eventId: event.eventId, publicationKind: event.kind,
      pagePath: event.pagePath, visitorId: event.visitorId, sessionId: event.sessionId, referrerOrigin: event.referrerOrigin,
      utmSource: event.utmSource, utmMedium: event.utmMedium, utmCampaign: event.utmCampaign,
    }).onConflictDoNothing().returning({ id: websitePageViews.eventId });
    return inserted.length ? 'recorded' as const : 'duplicate' as const;
  });
}

export async function ownsTrafficProject(uid: string, projectId: string, database = db) {
  const [owned] = await database.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1);
  return Boolean(owned);
}
