import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { businessPublications, publishedWebsites, websitePublicationVersions } from "@/app/db/schema";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { validateWebsitePublicationSnapshot } from "@/app/lib/website-publication";
import { visiblePublishedWebsitePages } from "@/app/lib/website-site-presentation";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalApplicationOrigin();
  if (!origin) return [];
  const [businesses, websites] = await Promise.all([
    db.select({ slug: businessPublications.publicSlug, updatedAt: businessPublications.updatedAt })
      .from(businessPublications).where(eq(businessPublications.status, "active")),
    db.select({ slug: publishedWebsites.slug, updatedAt: publishedWebsites.updatedAt, snapshot: websitePublicationVersions.snapshot })
      .from(publishedWebsites).innerJoin(websitePublicationVersions, and(
        eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id),
        eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion),
      )).where(eq(publishedWebsites.status, "active")),
  ]);
  const staticPages: MetadataRoute.Sitemap = ["", "/privacy", "/terms", "/refund-cancellation", "/contact-support"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path ? "yearly" : "weekly",
    priority: path ? 0.3 : 1,
  }));
  return [
    ...staticPages,
    ...businesses.map((item) => ({ url: `${origin}/business/${encodeURIComponent(item.slug)}`, lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...websites.flatMap((item) => {
      const snapshot = validateWebsitePublicationSnapshot(item.snapshot);
      if (!snapshot) return [];
      const paths = snapshot.schemaVersion === 2 ? visiblePublishedWebsitePages(snapshot.siteDocument).filter((page) => page.seo.index).map((page) => page.path) : ["/"];
      return paths.map((path) => ({ url: `${origin}/published-sites/${encodeURIComponent(item.slug)}${path === "/" ? "" : path}`, lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: path === "/" ? 0.8 : 0.6 }));
    }),
  ];
}
