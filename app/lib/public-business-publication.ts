import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { businessPublications, businessPublicationVersions } from "@/app/db/schema";
import { validateBusinessSlug, validatePublishedBusinessSnapshot } from "@/app/lib/business-publication";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";

export const loadPublishedBusiness = cache(async (candidate: string) => {
  const slug = validateBusinessSlug(candidate);
  if (!slug) return null;
  const [row] = await db.select({
    snapshot: businessPublicationVersions.snapshot,
    userId: businessPublications.userId,
    projectId: businessPublications.projectId,
  }).from(businessPublications).innerJoin(businessPublicationVersions, and(
    eq(businessPublicationVersions.publicationId, businessPublications.id),
    eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion),
  )).where(and(eq(businessPublications.publicSlug, slug), eq(businessPublications.status, "active"))).limit(1);
  if (!row || !await hasPaidProductAccess(row.userId)) return null;
  const snapshot = validatePublishedBusinessSnapshot(row.snapshot);
  return snapshot ? { snapshot, projectId: row.projectId } : null;
});
