import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/app/db";
import { publishedWebsites, websitePublicationVersions } from "@/app/db/schema";
import WebsitePreview from "@/app/dashboard/components/WebsitePreview";
import {
  validateWebsitePublicationSnapshot,
  validateWebsiteSlug,
} from "@/app/lib/website-publication";

export const dynamic = "force-dynamic";

export default async function PublishedWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const candidate = decodeURIComponent((await params).slug);
  const slug = validateWebsiteSlug(candidate);
  if (!slug) notFound();

  const [row] = await db
    .select({ snapshot: websitePublicationVersions.snapshot })
    .from(publishedWebsites)
    .innerJoin(
      websitePublicationVersions,
      and(
        eq(websitePublicationVersions.publishedWebsiteId, publishedWebsites.id),
        eq(websitePublicationVersions.versionNumber, publishedWebsites.currentVersion),
      ),
    )
    .where(and(eq(publishedWebsites.slug, slug), eq(publishedWebsites.status, "active")))
    .limit(1);

  const snapshot = validateWebsitePublicationSnapshot(row?.snapshot);
  if (!snapshot) notFound();

  return (
    <main className="min-h-screen bg-white">
      <WebsitePreview
        companyName={snapshot.companyName}
        industry={snapshot.industry}
        websiteGoal={snapshot.websiteGoal}
        websiteStyle={snapshot.template}
        websiteRequirements={snapshot.websiteRequirements}
        previewMode="desktop"
        brandResult={snapshot.websiteOutput}
      />
    </main>
  );
}
