import type { Metadata } from "next";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/app/db";
import { publishedWebsites, websitePublicationVersions } from "@/app/db/schema";
import WebsitePreview from "@/app/dashboard/components/WebsitePreview";
import {
  validateWebsitePublicationSnapshot,
  validateWebsiteSlug,
  publicWebsitePublicationView,
  publicWebsiteSeoDescription,
  publicWebsiteSeoTitle,
} from "@/app/lib/website-publication";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";

export const dynamic = "force-dynamic";

const loadPublishedWebsite = cache(async (candidate: string) => {
  const slug = validateWebsiteSlug(candidate);
  if (!slug) return null;
  const [row] = await db
    .select({ snapshot: websitePublicationVersions.snapshot, userId: publishedWebsites.ownerUid })
    .from(publishedWebsites)
    .innerJoin(websitePublicationVersions, and(eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id), eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion)))
    .where(and(eq(publishedWebsites.slug, slug), eq(publishedWebsites.status, "active"))).limit(1);
  if (!row || !await hasPaidProductAccess(row.userId)) return null;
  const stored = validateWebsitePublicationSnapshot(row.snapshot);
  return stored ? publicWebsitePublicationView(stored) : null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const snapshot = await loadPublishedWebsite(decodeURIComponent(slug));
  if (!snapshot) return { title: "Website not found" };
  const title = publicWebsiteSeoTitle(snapshot);
  const description = publicWebsiteSeoDescription(snapshot);
  const origin = canonicalApplicationOrigin();
  const canonical = origin ? `${origin}/published-sites/${encodeURIComponent(slug)}` : undefined;
  return { title, description, ...(canonical ? { alternates: { canonical } } : {}), robots: { index: true, follow: true }, openGraph: { title, description, ...(canonical ? { url: canonical } : {}), type: "website" } };
}

export default async function PublishedWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const snapshot = await loadPublishedWebsite(decodeURIComponent((await params).slug));
  if (!snapshot) notFound();

  return (
    <main className="min-h-screen bg-white">
      <WebsitePreview
        companyName={snapshot.companyName}
        industry={snapshot.industry}
        websiteGoal={snapshot.websiteGoal}
        websiteStyle={snapshot.websiteEdits?.template || snapshot.template}
        websiteRequirements={snapshot.websiteRequirements}
        previewMode="desktop"
        brandResult={snapshot.websiteOutput}
        websiteEdits={snapshot.websiteEdits}
        media={snapshot.media}
        siteDocument={snapshot.schemaVersion === 2 ? snapshot.siteDocument : undefined}
        pagePath="/"
        siteBasePath={`/published-sites/${encodeURIComponent((await params).slug)}`}
      />
    </main>
  );
}
