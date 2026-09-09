import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { publishedWebsites, websitePublicationVersions } from "@/app/db/schema";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";
import { publicWebsitePublicationView, validateWebsitePublicationSnapshot, validateWebsiteSlug } from "@/app/lib/website-publication";

export const loadActiveWebsitePublication = cache(async (candidate: string) => {
  const slug = validateWebsiteSlug(candidate);
  if (!slug) return null;
  const [row] = await db.select({
    snapshot: websitePublicationVersions.snapshot,
    userId: publishedWebsites.ownerUid,
    currentVersion: publishedWebsites.currentVersion,
    updatedAt: publishedWebsites.updatedAt,
  }).from(publishedWebsites).innerJoin(websitePublicationVersions, and(
    eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id),
    eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion),
  )).where(and(eq(publishedWebsites.slug, slug), eq(publishedWebsites.status, "active"))).limit(1);
  if (!row || !await hasPaidProductAccess(row.userId)) return null;
  const stored = validateWebsitePublicationSnapshot(row.snapshot);
  return stored ? { snapshot: publicWebsitePublicationView(stored), currentVersion: row.currentVersion, updatedAt: row.updatedAt } : null;
});
