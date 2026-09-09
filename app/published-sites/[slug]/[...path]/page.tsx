import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WebsitePreview from "@/app/dashboard/components/WebsitePreview";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { loadActiveWebsitePublication } from "@/app/lib/public-website-publication";
import { publicWebsitePageSeo, resolvePublishedWebsitePage } from "@/app/lib/website-site-presentation";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ slug: string; path: string[] }>;

function requestedPath(segments: string[]) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 2 || segments.some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))) return null;
  return `/${segments.join("/")}`;
}

async function loadPage(params: RouteParams) {
  const { slug, path: segments } = await params;
  const path = requestedPath(segments);
  if (!path) return null;
  const publication = await loadActiveWebsitePublication(decodeURIComponent(slug));
  const snapshot = publication?.snapshot;
  if (!publication || !snapshot || snapshot.schemaVersion !== 2) return null;
  const page = resolvePublishedWebsitePage(snapshot.siteDocument, path);
  return page ? { publication, snapshot, page, slug, path } : null;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const loaded = await loadPage(params);
  if (!loaded) return { title: "Website page not found", robots: { index: false, follow: false } };
  const seo = publicWebsitePageSeo(loaded.snapshot.siteDocument, loaded.path)!;
  const origin = canonicalApplicationOrigin();
  const canonical = origin ? `${origin}/published-sites/${encodeURIComponent(loaded.slug)}${seo.canonicalPath}` : undefined;
  return { title: seo.title, description: seo.description, ...(canonical ? { alternates: { canonical } } : {}), robots: { index: seo.index, follow: true }, openGraph: { title: seo.title, description: seo.description, ...(canonical ? { url: canonical } : {}), type: "website" } };
}

export default async function PublishedWebsiteSubpage({ params }: { params: RouteParams }) {
  const loaded = await loadPage(params);
  if (!loaded) notFound();
  const { snapshot } = loaded;
  return <main className="min-h-screen bg-white"><WebsitePreview
    companyName={snapshot.companyName} industry={snapshot.industry} websiteGoal={snapshot.websiteGoal}
    websiteStyle={snapshot.websiteEdits?.template || snapshot.template} websiteRequirements={snapshot.websiteRequirements}
    previewMode="desktop" brandResult={snapshot.websiteOutput} websiteEdits={snapshot.websiteEdits} media={snapshot.media}
    siteDocument={snapshot.siteDocument} pagePath={loaded.path} siteBasePath={`/published-sites/${encodeURIComponent(loaded.slug)}`}
  /></main>;
}
