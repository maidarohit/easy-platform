import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { businessPublications, publishedWebsites } from "@/app/db/schema";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = canonicalApplicationOrigin();
  if (!origin) return [];
  const [businesses, websites] = await Promise.all([
    db.select({ slug: businessPublications.publicSlug, updatedAt: businessPublications.updatedAt })
      .from(businessPublications).where(eq(businessPublications.status, "active")),
    db.select({ slug: publishedWebsites.slug, updatedAt: publishedWebsites.updatedAt })
      .from(publishedWebsites).where(eq(publishedWebsites.status, "active")),
  ]);
  const staticPages: MetadataRoute.Sitemap = ["", "/privacy", "/terms", "/refund-cancellation", "/contact-support"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path ? "yearly" : "weekly",
    priority: path ? 0.3 : 1,
  }));
  return [
    ...staticPages,
    ...businesses.map((item) => ({ url: `${origin}/business/${encodeURIComponent(item.slug)}`, lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...websites.map((item) => ({ url: `${origin}/published-sites/${encodeURIComponent(item.slug)}`, lastModified: item.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
