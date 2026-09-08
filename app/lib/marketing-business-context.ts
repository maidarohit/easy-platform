import "server-only";

import { db } from "@/app/db";
import { businessPublicationVersions, businessPublications, projects, publicBusinessInquiries, publishedWebsites, socialConnections, websitePublicationVersions } from "@/app/db/schema";
import { validatePublishedBusinessSnapshot } from "@/app/lib/business-publication";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { publicServices } from "@/app/lib/public-business-presentation";
import { validateWebsitePublicationSnapshot } from "@/app/lib/website-publication";
import { publicIndustryLabel } from "@/app/lib/public-website-presentation";
import { and, eq } from "drizzle-orm";

export type MarketingBusinessContext = {
  website: { published: boolean; url: string | null };
  business: { name: string; industry: string | null; location: string | null; services: string[]; description: string | null; targetAudience: string | null; brandStyle: string | null };
  channels: { meta: "connected" | "not_connected"; linkedin: "connected" | "not_connected"; whatsapp: "approved_contact" | "not_connected" };
  savedEnquiries: number;
  unavailableMetrics: string[];
};

export async function loadOwnedMarketingContext(userId: string, projectId: string): Promise<MarketingBusinessContext | null> {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  if (!project) return null;
  const [[businessRow], [legacyRow], connections, enquiries] = await Promise.all([
    db.select({ slug: businessPublications.publicSlug, snapshot: businessPublicationVersions.snapshot }).from(businessPublications)
      .innerJoin(businessPublicationVersions, and(eq(businessPublicationVersions.publicationId, businessPublications.id), eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion)))
      .where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, userId), eq(businessPublications.status, "active"))).limit(1),
    db.select({ slug: publishedWebsites.slug, snapshot: websitePublicationVersions.snapshot }).from(publishedWebsites)
      .innerJoin(websitePublicationVersions, and(eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id), eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion)))
      .where(and(eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, userId), eq(publishedWebsites.status, "active"))).limit(1),
    db.select({ provider: socialConnections.provider, status: socialConnections.status }).from(socialConnections)
      .where(and(eq(socialConnections.projectId, projectId), eq(socialConnections.userId, userId))),
    db.select({ id: publicBusinessInquiries.id }).from(publicBusinessInquiries).where(eq(publicBusinessInquiries.projectId, projectId)),
  ]);
  const origin = canonicalApplicationOrigin();
  const businessSnapshot = businessRow ? validatePublishedBusinessSnapshot(businessRow.snapshot) : null;
  const legacySnapshot = legacyRow ? validateWebsitePublicationSnapshot(legacyRow.snapshot) : null;
  const published = Boolean(businessSnapshot || legacySnapshot);
  const url = origin && businessSnapshot ? `${origin}/business/${encodeURIComponent(businessRow!.slug)}`
    : origin && legacySnapshot ? `${origin}/published-sites/${encodeURIComponent(legacyRow!.slug)}` : null;
  const connected = (provider: "meta" | "linkedin") => connections.some((item) => item.provider === provider && item.status === "connected") ? "connected" as const : "not_connected" as const;
  return {
    website: { published, url },
    business: businessSnapshot ? {
      name: businessSnapshot.business.name, industry: publicIndustryLabel(businessSnapshot.business.industry),
      location: businessSnapshot.contact?.location || null, services: publicServices(businessSnapshot).map((item) => item.title),
      description: businessSnapshot.business.description || null, targetAudience: project.targetAudience || null, brandStyle: project.brandStyle || null,
    } : legacySnapshot ? {
      name: legacySnapshot.websiteEdits?.companyName || legacySnapshot.companyName,
      industry: publicIndustryLabel(legacySnapshot.industry), location: legacySnapshot.websiteEdits?.address || null,
      services: legacySnapshot.websiteEdits?.servicesText ? [legacySnapshot.websiteEdits.servicesText] : [],
      description: legacySnapshot.websiteEdits?.heroDescription || legacySnapshot.websiteOutput.websiteOverview || null,
      targetAudience: project.targetAudience || null, brandStyle: project.brandStyle || null,
    } : {
      name: project.companyName || project.name, industry: publicIndustryLabel(project.industry), location: null, services: [],
      description: project.originalBrief || project.brandDescription || null, targetAudience: project.targetAudience || null, brandStyle: project.brandStyle || null,
    },
    channels: { meta: connected("meta"), linkedin: connected("linkedin"), whatsapp: businessSnapshot?.contact?.whatsapp || legacySnapshot?.websiteEdits?.whatsapp ? "approved_contact" : "not_connected" },
    savedEnquiries: enquiries.length,
    unavailableMetrics: ["website visitors", "engagement", "CTR", "campaign ROI", "CAC"],
  };
}
