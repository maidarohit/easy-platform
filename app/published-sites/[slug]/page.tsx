import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WebsitePreview from "@/app/dashboard/components/WebsitePreview";
import {
  publicWebsiteSeoDescription,
  publicWebsiteSeoTitle,
} from "@/app/lib/website-publication";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { loadActiveWebsitePublication } from "@/app/lib/public-website-publication";
import { publicWebsitePageSeo } from "@/app/lib/website-site-presentation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const publication = await loadActiveWebsitePublication(decodeURIComponent(slug));
  if (!publication) return { title: "Website not found" };
  const snapshot = publication.snapshot;
  const pageSeo = snapshot.schemaVersion === 2 ? publicWebsitePageSeo(snapshot.siteDocument, "/") : null;
  const title = pageSeo?.title || publicWebsiteSeoTitle(snapshot);
  const description = pageSeo?.description || publicWebsiteSeoDescription(snapshot);
  const origin = canonicalApplicationOrigin();
  const canonical = origin ? `${origin}/published-sites/${encodeURIComponent(slug)}` : undefined;
  return { title, description, ...(canonical ? { alternates: { canonical } } : {}), robots: { index: pageSeo?.index ?? true, follow: true }, openGraph: { title, description, ...(canonical ? { url: canonical } : {}), type: "website" } };
}

export default async function PublishedWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const publication = await loadActiveWebsitePublication(decodeURIComponent((await params).slug));
  if (!publication) notFound();
  const snapshot = publication.snapshot;

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
