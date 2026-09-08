import "server-only";

import { db } from "@/app/db";
import { businessPublications, projects, publicBusinessInquiries, publicBusinessOrders, publishedWebsites } from "@/app/db/schema";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { aggregateBusinessAnalytics } from "@/app/lib/analytics-metrics-calculation";
import { and, eq } from "drizzle-orm";

export async function loadOwnedBusinessAnalytics(userId: string, projectId: string) {
  const [project] = await db.select({
    id: projects.id,
    name: projects.name,
    companyName: projects.companyName,
    industry: projects.industry,
    description: projects.originalBrief,
    goal: projects.goal,
  }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return null;

  const [[publication], [legacyPublication], enquiries, orders] = await Promise.all([
    db.select({ slug: businessPublications.publicSlug }).from(businessPublications).where(and(
      eq(businessPublications.projectId, projectId), eq(businessPublications.userId, userId), eq(businessPublications.status, "active"),
    )).limit(1),
    db.select({ slug: publishedWebsites.slug }).from(publishedWebsites).where(and(
      eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, userId), eq(publishedWebsites.status, "active"),
    )).limit(1),
    db.select({ id: publicBusinessInquiries.id }).from(publicBusinessInquiries).where(eq(publicBusinessInquiries.projectId, projectId)),
    db.select({ status: publicBusinessOrders.status, paymentStatus: publicBusinessOrders.paymentStatus, totalPaise: publicBusinessOrders.totalPaise })
      .from(publicBusinessOrders).where(eq(publicBusinessOrders.projectId, projectId)),
  ]);
  const origin = canonicalApplicationOrigin();
  const publishedUrl = origin && publication
    ? `${origin}/business/${encodeURIComponent(publication.slug)}`
    : origin && legacyPublication
      ? `${origin}/published-sites/${encodeURIComponent(legacyPublication.slug)}`
      : null;
  return { project, metrics: aggregateBusinessAnalytics({ enquiries, orders, published: Boolean(publication || legacyPublication), publishedUrl }) };
}
