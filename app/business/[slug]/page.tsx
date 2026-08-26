import type { Metadata } from "next";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/app/db";
import { businessPublications, businessPublicationVersions } from "@/app/db/schema";
import { validateBusinessSlug, validatePublishedBusinessSnapshot } from "@/app/lib/business-publication";

export const dynamic = "force-dynamic";

const loadPublishedBusiness = cache(async (candidate: string) => {
  const slug = validateBusinessSlug(candidate);
  if (!slug) return null;
  const [row] = await db.select({ snapshot: businessPublicationVersions.snapshot }).from(businessPublications)
    .innerJoin(businessPublicationVersions, and(
      eq(businessPublicationVersions.publicationId, businessPublications.id),
      eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion),
    )).where(and(eq(businessPublications.publicSlug, slug), eq(businessPublications.status, "active"))).limit(1);
  return validatePublishedBusinessSnapshot(row?.snapshot);
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const snapshot = await loadPublishedBusiness(decodeURIComponent((await params).slug));
  if (!snapshot) return { title: "Business not found" };
  return {
    title: snapshot.search?.title || snapshot.business.name,
    description: snapshot.search?.description || snapshot.website?.supportingText || snapshot.business.description || undefined,
    robots: { index: true, follow: true },
  };
}

export default async function PublicBusinessPage({ params }: Props) {
  const snapshot = await loadPublishedBusiness(decodeURIComponent((await params).slug));
  if (!snapshot) notFound();
  const primary = snapshot.brand?.colours[0] || "#173D32";
  const accent = snapshot.brand?.colours[1] || "#EEE9DC";
  const website = snapshot.website;
  return <main className="min-h-screen bg-[#FCFBF7] text-[#1B211E]">
    <header className="border-b border-black/10 bg-white px-5 py-5 sm:px-10"><div className="mx-auto flex max-w-6xl items-center justify-between gap-5"><strong className="text-xl" style={{ color: primary }}>{snapshot.business.name}</strong>{website?.primaryCta && <a href="#contact" className="rounded-full px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ backgroundColor: primary }}>{website.primaryCta}</a>}</div></header>
    <section className="px-5 py-20 text-center text-white sm:px-10 sm:py-28" style={{ backgroundColor: primary }}><div className="mx-auto max-w-5xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-65">{snapshot.business.industry}</p><h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-7xl">{website?.heroHeadline || snapshot.brand?.tagline || snapshot.business.name}</h1>{website?.supportingText && <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 opacity-80">{website.supportingText}</p>}{website?.primaryCta && <a href="#contact" className="mt-8 inline-flex rounded-full bg-white px-7 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4" style={{ color: primary }}>{website.primaryCta}</a>}</div></section>
    {website?.services && <section className="px-5 py-16 sm:px-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">What we offer</p><div className="mt-7 grid gap-5 md:grid-cols-3">{website.serviceCards.length >= 3 ? website.serviceCards.map((card) => <article key={`${card.title}-${card.description}`} className="rounded-3xl border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold" style={{ color: primary }}>{card.title}</h2><p className="mt-3 leading-7 opacity-70">{card.description}</p></article>) : <p className="whitespace-pre-wrap leading-8 opacity-75 md:col-span-3">{website.services}</p>}</div></div></section>}
    {website?.about && <section className="px-5 py-16 sm:px-10" style={{ backgroundColor: accent }}><div className="mx-auto max-w-4xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Our value</p><h2 className="mt-5 text-3xl font-semibold sm:text-5xl">Why this business exists</h2><p className="mt-6 whitespace-pre-wrap text-lg leading-8 opacity-75">{website.about}</p></div></section>}
    <section id="contact" className="px-5 py-20 text-center text-white sm:px-10" style={{ backgroundColor: primary }}><h2 className="text-3xl font-semibold sm:text-5xl">Ready to take the next step?</h2>{snapshot.journey?.primaryCta && <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 opacity-80">{snapshot.journey.primaryCta}</p>}{website?.contact && <p className="mt-5 font-semibold">{website.contact}</p>}</section>
    <footer className="bg-[#102A23] px-5 py-8 text-center text-sm text-white/65">© {new Date().getUTCFullYear()} {snapshot.business.name}</footer>
  </main>;
}
