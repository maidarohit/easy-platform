import { db } from "@/app/db";
import { businessPublications, businessPublicationVersions, projects, publishedWebsites, websitePublicationVersions } from "@/app/db/schema";
import {
  completeAiUsage,
  failAiUsage,
  startAiUsage,
} from "@/app/lib/ai-usage";
import { parseAiUsageMetadata, type AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { associateN8nExecution } from "@/app/lib/ai-usage-reconciliation";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { readValidatedAiRequest } from "@/app/lib/ai-request-validation";
import { parseN8nExecutionId } from "@/app/lib/n8n-executions";
import { getN8nWebhookConfig, n8nConfigurationErrorResponse } from "@/app/lib/n8n-webhooks";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { publicSeoDescription, publicSeoTitle, publicServices } from "@/app/lib/public-business-presentation";
import { validatePublishedBusinessSnapshot } from "@/app/lib/business-publication";
import { normalizeSeoOpportunities, SEO_GROUNDING_RULES } from "@/app/lib/seo-opportunity-safety";
import { buildSeoSiteAudit } from "@/app/lib/seo-site-audit";
import { publicWebsiteSeoDescription, publicWebsiteSeoTitle, validateWebsitePublicationSnapshot } from "@/app/lib/website-publication";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const SEO_AI_WORKFLOW = "seo-ai";

async function finalizeUsage(
  usageId: string,
  status: "success" | "failed",
  startedAt: number,
  usageComponents?: readonly AiUsageComponent[]
) {
  try {
    const durationMs = Date.now() - startedAt;

    if (status === "success") {
      await completeAiUsage({ usageId, durationMs, usageComponents });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
    return true;
  } catch {
    console.error("SEO AI usage finalization failed.");
    return false;
  }
}

async function loadOwnedSiteAudit(uid: string, projectId: string) {
  const [ownedProject] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, uid))).limit(1);
  if (!ownedProject) return null;

  const [[businessRow], [websiteRow]] = await Promise.all([
    db.select({ slug: businessPublications.publicSlug, snapshot: businessPublicationVersions.snapshot })
      .from(businessPublications)
      .innerJoin(businessPublicationVersions, and(eq(businessPublicationVersions.publicationId, businessPublications.id), eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion)))
      .where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, uid), eq(businessPublications.status, "active"))).limit(1),
    db.select({ slug: publishedWebsites.slug, snapshot: websitePublicationVersions.snapshot })
      .from(publishedWebsites)
      .innerJoin(websitePublicationVersions, and(eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id), eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion)))
      .where(and(eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, uid), eq(publishedWebsites.status, "active"))).limit(1),
  ]);
  const origin = canonicalApplicationOrigin();
  const businessSnapshot = businessRow ? validatePublishedBusinessSnapshot(businessRow.snapshot) : null;
  if (businessSnapshot) {
    const url = origin ? `${origin}/business/${encodeURIComponent(businessRow.slug)}` : null;
    const services = publicServices(businessSnapshot);
    const publicSections = [businessSnapshot.website?.supportingText, services.length, businessSnapshot.website?.about, businessSnapshot.website?.features, businessSnapshot.contact].filter(Boolean).length;
    const imageCount = [businessSnapshot.website?.heroImage, businessSnapshot.website?.secondaryImage].filter(Boolean).length;
    return buildSeoSiteAudit({ published: true, publishedUrl: url, title: publicSeoTitle(businessSnapshot), metaDescription: publicSeoDescription(businessSnapshot), hasH1: true, hasOrderedHeadings: true, publicSectionCount: publicSections, internalLinkCount: 3 + publicSections, imageCount, imagesHaveAltText: true, hasStructuredData: false });
  }
  const websiteSnapshot = websiteRow ? validateWebsitePublicationSnapshot(websiteRow.snapshot) : null;
  if (websiteSnapshot) {
    const url = origin ? `${origin}/published-sites/${encodeURIComponent(websiteRow.slug)}` : null;
    const edits = websiteSnapshot.websiteEdits;
    const publicSections = [edits?.heroDescription || websiteSnapshot.websiteOutput.websiteOverview, edits?.servicesText, edits?.aboutText].filter(Boolean).length;
    const imageCount = Object.values(websiteSnapshot.media ?? {}).flatMap((item) => Array.isArray(item) ? item : item ? [item] : []).length;
    return buildSeoSiteAudit({ published: true, publishedUrl: url, title: publicWebsiteSeoTitle(websiteSnapshot), metaDescription: publicWebsiteSeoDescription(websiteSnapshot), hasH1: true, hasOrderedHeadings: true, publicSectionCount: publicSections, internalLinkCount: 3 + publicSections, imageCount, imagesHaveAltText: true, hasStructuredData: false });
  }
  return buildSeoSiteAudit({ published: false });
}

export async function GET(request: Request) {
  let uid: string;
  try {
    uid = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  try {
    const siteAudit = await loadOwnedSiteAudit(uid, projectId);
    return siteAudit
      ? NextResponse.json({ siteAudit }, { headers: { "Cache-Control": "private, no-store" } })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch {
    console.error("SEO site audit load failed.");
    return NextResponse.json({ error: "Unable to load website check." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uid: string;

  try {
    uid = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 }
    );
  }

  const validation = await readValidatedAiRequest(request, "seo");
  if (!validation.ok) return validation.response;
  const body = validation.body;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required." },
      { status: 400 }
    );
  }

  let publicationContext: Record<string, unknown>;
  let siteAudit: ReturnType<typeof buildSeoSiteAudit>;
  try {
    const [ownedProject] = await db
      .select({ id: projects.id, name: projects.name, companyName: projects.companyName, industry: projects.industry, location: projects.location, originalBrief: projects.originalBrief, targetAudience: projects.targetAudience, goal: projects.goal, brandStyle: projects.brandStyle, brandDescription: projects.brandDescription })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, uid)))
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [[businessRow], [websiteRow]] = await Promise.all([
      db.select({ slug: businessPublications.publicSlug, snapshot: businessPublicationVersions.snapshot })
        .from(businessPublications)
        .innerJoin(businessPublicationVersions, and(eq(businessPublicationVersions.publicationId, businessPublications.id), eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion)))
        .where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, uid), eq(businessPublications.status, "active"))).limit(1),
      db.select({ slug: publishedWebsites.slug, snapshot: websitePublicationVersions.snapshot })
        .from(publishedWebsites)
        .innerJoin(websitePublicationVersions, and(eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id), eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion)))
        .where(and(eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, uid), eq(publishedWebsites.status, "active"))).limit(1),
    ]);
    const origin = canonicalApplicationOrigin();
    const businessSnapshot = businessRow ? validatePublishedBusinessSnapshot(businessRow.snapshot) : null;
    const websiteSnapshot = websiteRow ? validateWebsitePublicationSnapshot(websiteRow.snapshot) : null;
    if (businessSnapshot) {
      const url = origin ? `${origin}/business/${encodeURIComponent(businessRow.slug)}` : null;
      const services = publicServices(businessSnapshot);
      const publicSections = [businessSnapshot.website?.supportingText, services.length, businessSnapshot.website?.about, businessSnapshot.website?.features, businessSnapshot.contact].filter(Boolean).length;
      const imageCount = [businessSnapshot.website?.heroImage, businessSnapshot.website?.secondaryImage].filter(Boolean).length;
      siteAudit = buildSeoSiteAudit({ published: true, publishedUrl: url, title: publicSeoTitle(businessSnapshot), metaDescription: publicSeoDescription(businessSnapshot), hasH1: true, hasOrderedHeadings: true, publicSectionCount: publicSections, internalLinkCount: 3 + publicSections, imageCount, imagesHaveAltText: true, hasStructuredData: false });
      publicationContext = { published: true, businessName: businessSnapshot.business.name, industry: businessSnapshot.business.industry, businessDescription: businessSnapshot.business.description, targetAudience: ownedProject.targetAudience || ownedProject.goal || null, brandStyle: ownedProject.brandStyle || null, location: businessSnapshot.contact?.location || null, services: services.map((item) => item.title), title: publicSeoTitle(businessSnapshot), metaDescription: publicSeoDescription(businessSnapshot) || null, publicationUrl: url, measurableGaps: Object.entries(siteAudit.checks).filter(([, item]) => item.status === "missing").map(([key]) => key) };
    } else if (websiteSnapshot) {
      const url = origin ? `${origin}/published-sites/${encodeURIComponent(websiteRow.slug)}` : null;
      const edits = websiteSnapshot.websiteEdits;
      const publicSections = [edits?.heroDescription || websiteSnapshot.websiteOutput.websiteOverview, edits?.servicesText, edits?.aboutText].filter(Boolean).length;
      const imageCount = Object.values(websiteSnapshot.media ?? {}).flatMap((item) => Array.isArray(item) ? item : item ? [item] : []).length;
      siteAudit = buildSeoSiteAudit({ published: true, publishedUrl: url, title: publicWebsiteSeoTitle(websiteSnapshot), metaDescription: publicWebsiteSeoDescription(websiteSnapshot), hasH1: true, hasOrderedHeadings: true, publicSectionCount: publicSections, internalLinkCount: 3 + publicSections, imageCount, imagesHaveAltText: true, hasStructuredData: false });
      publicationContext = { published: true, businessName: edits?.companyName || websiteSnapshot.companyName, industry: websiteSnapshot.industry || null, businessDescription: edits?.heroDescription || websiteSnapshot.websiteOutput.websiteOverview, targetAudience: ownedProject.targetAudience || ownedProject.goal || null, brandStyle: ownedProject.brandStyle || null, location: null, services: edits?.servicesText || null, title: publicWebsiteSeoTitle(websiteSnapshot), metaDescription: publicWebsiteSeoDescription(websiteSnapshot) || null, publicationUrl: url, measurableGaps: Object.entries(siteAudit.checks).filter(([, item]) => item.status === "missing").map(([key]) => key) };
    } else {
      siteAudit = buildSeoSiteAudit({ published: false });
      publicationContext = { published: false, businessName: ownedProject.companyName || ownedProject.name, industry: ownedProject.industry || null, businessDescription: ownedProject.originalBrief || ownedProject.brandDescription || null, targetAudience: ownedProject.targetAudience || ownedProject.goal || null, brandStyle: ownedProject.brandStyle || null, location: ownedProject.location || null, services: null, title: null, metaDescription: null, publicationUrl: null, measurableGaps: [] };
    }
  } catch {
    console.error("SEO AI project authorization failed.");
    return NextResponse.json(
      { error: "Unable to authorize project." },
      { status: 500 }
    );
  }

  const webhook = getN8nWebhookConfig("N8N_SEO_AI_WEBHOOK_URL");
  if (!webhook) return n8nConfigurationErrorResponse();

  let usageId: string;

  try {
    usageId = await startAiUsage({
      userId: uid,
      projectId,
      module: "seo",
      workflow: SEO_AI_WORKFLOW,
      model: null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("SEO AI usage initialization failed.");
    return NextResponse.json(
      { error: "Unable to track SEO AI request." },
      { status: 500 }
    );
  }

  const seoPayload = {
    companyName: publicationContext.businessName,
    industry: publicationContext.industry,
    targetAudience: publicationContext.targetAudience,
    brandStyle: publicationContext.brandStyle,
    brandDescription: publicationContext.businessDescription,
    publicationContext,
    recommendationRules: SEO_GROUNDING_RULES,
  };
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        ...webhook.headers,
      },
      body: JSON.stringify(seoPayload),
      signal: controller.signal,
    });

    const usageMetadata = parseAiUsageMetadata(response.headers);
    const n8nExecutionId = parseN8nExecutionId(response.headers);
    const text = await response.text();

    console.log("STATUS:", response.status);

    if (!response.ok) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "SEO AI request failed." },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "SEO AI returned an empty response." },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(text);
      const usageFinalized = await finalizeUsage(usageId, "success", startedAt, usageMetadata?.components);
      if (n8nExecutionId) {
        try {
          await associateN8nExecution({ usageId, executionId: n8nExecutionId, metadataAlreadyApplied: Boolean(usageMetadata) && usageFinalized });
        } catch {
          console.error("SEO AI execution association failed.");
        }
      }
      return NextResponse.json({ siteAudit, seoOpportunities: normalizeSeoOpportunities(data, publicationContext) });
    } catch {
      await finalizeUsage(usageId, "failed", startedAt);
      return NextResponse.json(
        { error: "SEO AI returned invalid JSON." },
        { status: 502 }
      );
    }
  } catch {
    await finalizeUsage(usageId, "failed", startedAt);
    console.error("SEO AI request failed.");

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
