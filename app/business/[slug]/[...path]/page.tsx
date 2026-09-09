import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WebsiteSiteRenderer from "@/app/dashboard/components/WebsiteSiteRenderer";
import { loadPublishedBusiness } from "@/app/lib/public-business-publication";
import { publicBusinessView, publicServices } from "@/app/lib/public-business-presentation";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";
import { publicWebsitePageSeo, resolvePublishedWebsitePage } from "@/app/lib/website-site-presentation";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; path: string[] }> };

async function loadPage(params: Props["params"]) {
  const { slug: encodedSlug, path: segments } = await params;
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 2) return null;
  const slug = decodeURIComponent(encodedSlug);
  const published = await loadPublishedBusiness(slug);
  const snapshot = published && publicBusinessView(published.snapshot);
  const path = `/${segments.map((segment) => decodeURIComponent(segment)).join("/")}`;
  if (!snapshot?.siteDocument || !resolvePublishedWebsitePage(snapshot.siteDocument, path)) return null;
  return { slug, path, snapshot };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await loadPage(params);
  if (!loaded) return { title: "Page not found" };
  const seo = publicWebsitePageSeo(loaded.snapshot.siteDocument!, loaded.path)!;
  const origin = canonicalApplicationOrigin();
  const canonical = origin ? `${origin}/business/${encodeURIComponent(loaded.slug)}${seo.canonicalPath}` : undefined;
  return { title: seo.title, description: seo.description, ...(canonical ? { alternates: { canonical } } : {}), robots: { index: seo.index, follow: true } };
}

export default async function PublicBusinessChildPage({ params }: Props) {
  const loaded = await loadPage(params);
  if (!loaded) notFound();
  return <WebsiteSiteRenderer document={loaded.snapshot.siteDocument!} pagePath={loaded.path} basePath={`/business/${encodeURIComponent(loaded.slug)}`} industry={loaded.snapshot.business.industry ?? ""} description={loaded.snapshot.business.description ?? ""} media={{ hero: loaded.snapshot.website?.heroImage, work: loaded.snapshot.website?.secondaryImage }} serviceItems={publicServices(loaded.snapshot).map((service, index) => ({ id: `published-service-${index + 1}`, title: service.title, description: service.description }))} contact={loaded.snapshot.contact} inquirySlug={loaded.slug} publicPageOnly />;
}
