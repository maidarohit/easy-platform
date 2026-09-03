import type { Metadata } from "next";
import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/app/db";
import { businessPublications, businessPublicationVersions, projectMerchantPaymentAccounts, projectProducts } from "@/app/db/schema";
import { validateBusinessSlug, validatePublishedBusinessSnapshot } from "@/app/lib/business-publication";
import { publicAudience, publicBusinessKind, publicCallToAction, publicContact, publicHeroCopy, publicProcess, publicSeoDescription, publicServices, publicServicesSummary, publicStory, publicValuePoints } from "@/app/lib/public-business-presentation";
import { InquiryForm } from "@/app/business/[slug]/InquiryForm";
import { OrderForm } from "@/app/business/[slug]/OrderForm";
import { BusinessSiteVisual } from "@/app/components/BusinessSiteVisual";
import { resolveWebsiteMedia, uploadedSrcFromRecord } from "@/app/lib/business-site-visuals";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";
import { isStoreRazorpayCheckoutEnabled, merchantAccountCanAcceptCheckout } from "@/app/lib/store-checkout-core";
import { getStoreCheckoutPublicKey } from "@/app/lib/store-checkout-razorpay";

export const dynamic = "force-dynamic";
function formatInr(pricePaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(pricePaise / 100);
}
function catalogueLabel(items: readonly { kind: "product" | "service"; category: string | null; name: string }[]) {
  if (items.every((item) => item.kind === "product")) return "Products";
  if (items.every((item) => item.kind === "service")) {
    return items.some((item) => /package|plan|bundle/i.test(`${item.category ?? ""} ${item.name}`)) ? "Packages" : "Services";
  }
  return "Store";
}
const loadPublishedBusiness = cache(async (candidate: string) => {
  const slug = validateBusinessSlug(candidate); if (!slug) return null;
  const [row] = await db.select({
    snapshot: businessPublicationVersions.snapshot,
    userId: businessPublications.userId,
    projectId: businessPublications.projectId,
  }).from(businessPublications)
    .innerJoin(businessPublicationVersions, and(eq(businessPublicationVersions.publicationId, businessPublications.id), eq(businessPublicationVersions.versionNumber, businessPublications.currentVersion)))
    .where(and(eq(businessPublications.publicSlug, slug), eq(businessPublications.status, "active"))).limit(1);
  if (!row || !await hasPaidProductAccess(row.userId)) return null;
  const snapshot = validatePublishedBusinessSnapshot(row.snapshot);
  return snapshot ? { snapshot, projectId: row.projectId } : null;
});
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string | string[]; product?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const published = await loadPublishedBusiness(decodeURIComponent((await params).slug));
  if (!published) return { title: "Business not found" };
  const snapshot = published.snapshot;
  const title = snapshot.search?.title || snapshot.business.name;
  const description = publicSeoDescription(snapshot);
  return { title, description, robots: { index: true, follow: true }, openGraph: { title, description, type: "website" } };
}

export default async function PublicBusinessPage({ params, searchParams }: Props) {
  const slug = decodeURIComponent((await params).slug); const published = await loadPublishedBusiness(slug); if (!published) notFound();
  const snapshot = published.snapshot;
  const catalogue = await db.select({
    id: projectProducts.id, name: projectProducts.name, kind: projectProducts.kind, category: projectProducts.category,
    description: projectProducts.description, pricePaise: projectProducts.pricePaise,
  }).from(projectProducts).where(and(eq(projectProducts.projectId, published.projectId), eq(projectProducts.isActive, true)))
    .orderBy(asc(projectProducts.sortOrder), desc(projectProducts.createdAt));
  const [merchant] = await db.select({
    projectId: projectMerchantPaymentAccounts.projectId,
    provider: projectMerchantPaymentAccounts.provider,
    providerAccountId: projectMerchantPaymentAccounts.providerAccountId,
    status: projectMerchantPaymentAccounts.status,
  }).from(projectMerchantPaymentAccounts).where(and(
    eq(projectMerchantPaymentAccounts.projectId, published.projectId),
    eq(projectMerchantPaymentAccounts.provider, "razorpay"),
  )).limit(1);
  const checkoutReady = Boolean(merchant
    && isStoreRazorpayCheckoutEnabled()
    && getStoreCheckoutPublicKey()
    && merchantAccountCanAcceptCheckout({ ...merchant, expectedProjectId: published.projectId }));
  const storeLabel = catalogueLabel(catalogue);
  const primary = snapshot.brand?.colours[0] || "#173D32"; const accent = snapshot.brand?.colours[1] || "#E9E4D8";
  const cta = publicCallToAction(snapshot); const contact = publicContact(snapshot); const services = publicServices(snapshot);
  const summary = publicServicesSummary(snapshot); const audience = publicAudience(snapshot); const process = publicProcess(snapshot);
  const values = publicValuePoints(snapshot); const story = publicStory(snapshot); const kind = publicBusinessKind(snapshot);
  const heroCopy = publicHeroCopy(snapshot); const offeringLabel = kind.workLabel === "Featured range" ? "Products" : "Services";
  const query = await searchParams; const requestedService = query.service; const selectedService = typeof requestedService === "string" && services.some((item) => item.title === requestedService) ? requestedService : "";
  const requestedProduct = query.product; const selectedProductId = typeof requestedProduct === "string" && catalogue.some((item) => item.id === requestedProduct) ? requestedProduct : "";
  const visualContext = { industry: snapshot.business.industry, description: snapshot.business.description };
  const media = resolveWebsiteMedia({ ...visualContext, uploaded: { hero: uploadedSrcFromRecord(snapshot.website, "hero") } });
  const heroVisual = media.hero; const aboutVisual = media.about; const showcaseVisuals = media.work;
  const ctaVisual = { src: "" };
  const hasWork = Boolean(snapshot.website?.businessVideo || showcaseVisuals.length);
  const nav = [{ href: "#home", label: "Home" }, ...(services.length || summary ? [{ href: "#services", label: offeringLabel }] : []), ...(hasWork ? [{ href: "#work", label: kind.workLabel }] : []), ...(story ? [{ href: "#about", label: "About" }] : []), { href: "#process", label: "Process" }, ...(catalogue.length > 0 ? [{ href: "#store", label: storeLabel }] : []), { href: "#contact", label: "Contact" }];
  return <main className="min-h-screen bg-[#FCFBF7] text-[#1B211E]">
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#FCFBF7]/95 px-5 py-4 backdrop-blur sm:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between gap-5"><a href="#home" className="text-xl font-bold tracking-[-0.03em]" style={{ color: primary }}>{snapshot.brand?.name || snapshot.business.name}</a><nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">{nav.map((item) => <a key={item.href} href={item.href} className="text-sm font-semibold opacity-70 transition hover:opacity-100">{item.label}</a>)}</nav><a href="#contact" className="rounded-full px-5 py-3 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>{cta}</a></div><nav aria-label="Mobile navigation" className="mx-auto mt-3 flex max-w-7xl gap-5 overflow-x-auto pb-1 lg:hidden">{nav.map((item) => <a key={item.href} href={item.href} className="shrink-0 text-xs font-semibold opacity-70">{item.label}</a>)}</nav></header>
    <section id="home" className="relative scroll-mt-28 overflow-hidden px-5 py-16 sm:px-10 sm:py-24" style={{ background: `linear-gradient(165deg, ${primary} 0%, ${primary}F2 58%, ${primary}E6 100%)` }}><div className={`relative mx-auto grid max-w-7xl items-center gap-10 ${heroVisual ? "lg:grid-cols-[1.2fr_.8fr]" : ""}`}><div className="text-white"><p className="text-xs font-bold uppercase tracking-[0.24em] opacity-70">{snapshot.business.industry || snapshot.business.name}</p><h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-0.06em] sm:text-7xl">{snapshot.website?.heroHeadline || snapshot.brand?.tagline || snapshot.business.name}</h1>{heroCopy && <p className="mt-7 max-w-xl text-lg leading-8 text-white/75">{heroCopy}</p>}<div className="mt-8 flex flex-wrap gap-3"><a href="#contact" className="rounded-full bg-white px-7 py-4 font-semibold" style={{ color: primary }}>{cta}</a>{services.length > 0 && <a href="#services" className="rounded-full border border-white/40 px-7 py-4 font-semibold text-white">Explore our work</a>}</div></div>{heroVisual && <div className="relative"><BusinessSiteVisual src={heroVisual.src} alt={heroVisual.alt} interactive overlay className="aspect-[4/3] min-h-56 shadow-2xl" roundedClassName="rounded-[2rem] border border-white/20" /></div>}</div></section>
    {audience.length > 0 && <section className="px-5 py-20 sm:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>{kind.audienceLabel}</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Built around the people we serve.</h2><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{audience.map((item) => <article key={item.title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(20,30,25,.06)]"><h3 className="text-lg font-semibold" style={{ color: primary }}>{item.title}</h3>{item.description && <p className="mt-3 text-sm leading-6 opacity-65">{item.description}</p>}</article>)}</div></div></section>}
    {(services.length > 0 || summary) && <section id="services" className="px-5 py-20 sm:px-10" style={{ backgroundColor: `${accent}88` }}><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>{kind.workLabel}</p><div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end"><h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Services shaped around real needs.</h2>{summary && <p className="max-w-xl leading-7 opacity-65">{summary}</p>}</div>{services.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map((service, index) => { const visual = resolveWebsiteMedia({ ...visualContext, uploaded: { services: uploadedSrcFromRecord(service, "services") } }).services[0]; return <article key={service.title} className="business-site-card group overflow-hidden rounded-[2rem] border border-black/10 bg-[#FCFBF7]">{visual && <BusinessSiteVisual src={visual.src} alt={visual.alt} className="h-36" roundedClassName="rounded-none" />}<div className="p-7"><span className="text-sm font-bold opacity-35">0{index + 1}</span><h3 className="mt-4 text-2xl font-semibold" style={{ color: primary }}>{service.title}</h3>{service.description && <p className="mt-4 leading-7 opacity-65">{service.description}</p>}<a href={`?service=${encodeURIComponent(service.title)}#contact`} className="mt-7 inline-flex text-sm font-bold">Enquire <span aria-hidden="true" className="ml-2">&rarr;</span></a></div></article>; })}</div>}</div></section>}
    {hasWork && <section id="work" aria-label={kind.workLabel} className="scroll-mt-28 px-5 py-20 sm:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>{kind.workLabel}</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Thoughtful work, presented with clarity and purpose.</h2>{showcaseVisuals.length > 0 && <div className="mt-10 grid gap-4 md:grid-cols-12">{showcaseVisuals.map((visual, index) => { const featured = index === 0; const wide = index === 0 || index === 3; return <div key={`${visual.src}-${index}`} className={`business-site-card overflow-hidden rounded-[2rem] border border-black/10 ${wide ? "md:col-span-8" : "md:col-span-4"} ${featured ? "relative min-h-72" : "min-h-36"}`}>{featured ? <><BusinessSiteVisual src={visual.src} alt={visual.alt} className="absolute inset-0 h-full min-h-72" roundedClassName="rounded-none" overlay /><div className="relative flex h-full min-h-72 items-end p-8 text-white"><p className="max-w-md text-2xl font-semibold tracking-[-0.04em]">{kind.workLabel}</p></div></> : <BusinessSiteVisual src={visual.src} alt={visual.alt} className="h-full min-h-36" roundedClassName="rounded-none" />}</div>; })}</div>}</div></section>}
    {values.length > 0 && <section className="px-5 py-20 text-white sm:px-10" style={{ backgroundColor: primary }}><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em] opacity-65">Why work with us</p><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{values.map((item) => <article key={item.title} className="rounded-3xl border border-white/15 bg-white/5 p-6"><h3 className="text-xl font-semibold">{item.title}</h3>{item.description && <p className="mt-3 text-sm leading-6 text-white/65">{item.description}</p>}</article>)}</div></div></section>}
    <section id="process" className="px-5 py-20 sm:px-10"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>How it works</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A clear path from interest to action.</h2><ol className="mt-10 grid gap-4 md:grid-cols-3">{process.map((step, index) => <li key={`${step}-${index}`} className="rounded-3xl border border-black/10 bg-white p-6"><span className="text-sm font-bold" style={{ color: primary }}>{String(index + 1).padStart(2, "0")}</span><p className="mt-5 text-lg font-semibold">{step}</p></li>)}</ol></div></section>
    {story && <section id="about" className="px-5 py-20 sm:px-10"><div className={`mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-black/10 bg-white ${aboutVisual ? "lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>{aboutVisual && <BusinessSiteVisual src={aboutVisual.src} alt={aboutVisual.alt} className="min-h-64 lg:min-h-full" roundedClassName="rounded-none" />}<div className="flex flex-col justify-center p-8 sm:p-12"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>Our story</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Purpose behind the work.</h2><p className="mt-6 whitespace-pre-wrap text-lg leading-8 opacity-70">{story}</p></div></div></section>}
    {kind.b2b && audience.length > 0 && <section className="px-5 py-16 sm:px-10" style={{ backgroundColor: `${accent}22` }}><div className="mx-auto max-w-7xl rounded-[2rem] border border-black/10 bg-white p-8 sm:p-12"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>For professional teams</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">A capable partner for considered projects.</h2><p className="mt-4 max-w-3xl leading-7 opacity-65">Start a conversation about your requirements, timeline and the right next step.</p></div></section>}
    {catalogue.length > 0 && <section id="store" className="scroll-mt-28 px-5 py-20 sm:px-10" style={{ backgroundColor: `${accent}44` }}><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: primary }}>{storeLabel}</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{storeLabel} from {snapshot.business.name}.</h2><p className="mt-4 max-w-2xl leading-7 opacity-65">{checkoutReady ? "Choose an item and complete your purchase securely." : "Choose an item and send a request to the business."}</p><div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{catalogue.map((item) => <article key={item.id} className="business-site-card rounded-[2rem] border border-black/10 bg-white p-7"><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-55">{item.kind === "service" ? "Service" : "Product"}</p><h3 className="mt-4 text-2xl font-semibold" style={{ color: primary }}>{item.name}</h3>{item.category && <p className="mt-2 text-sm opacity-65">{item.category}</p>}{item.description && <p className="mt-4 leading-7 opacity-65">{item.description}</p>}<p className="mt-5 text-lg font-semibold">{formatInr(item.pricePaise)}</p><a href={`?product=${encodeURIComponent(item.id)}#order`} className="mt-6 inline-flex text-sm font-bold">{checkoutReady ? "Buy" : "Enquire"} <span aria-hidden="true" className="ml-2">→</span></a></article>)}</div><div className="mx-auto mt-10 max-w-3xl"><OrderForm slug={slug} products={catalogue.map((item) => ({ id: item.id, name: item.name, kind: item.kind }))} selectedProductId={selectedProductId} primary={primary} checkoutReady={checkoutReady} /></div></div></section>}
    <section id="contact" className="relative scroll-mt-28 overflow-hidden px-5 py-20 text-white sm:px-10" style={{ backgroundColor: primary }}><div aria-hidden="true" className="business-site-cta-pattern pointer-events-none absolute inset-0 opacity-40"/><div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] opacity-25 lg:block"><BusinessSiteVisual src={ctaVisual.src} alt="" className="h-full min-h-full" roundedClassName="rounded-none" /></div><div className="relative mx-auto max-w-7xl"><div className="max-w-3xl text-left sm:text-center sm:mx-auto"><p className="text-xs font-bold uppercase tracking-[0.22em] opacity-65">Let&apos;s talk</p><h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Ready to take the next step?</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">Tell us what you are looking for and we’ll help you find the right way forward.</p></div>{contact.methods.length > 0 && <div className="mx-auto mt-9 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">{contact.methods.map((item) => <a key={item.href} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noreferrer" : undefined} className="business-site-card rounded-2xl border border-white/20 bg-white/10 p-5"><span className="block text-xs font-bold uppercase tracking-[0.18em] text-white/55">{item.label}</span><span className="mt-2 block break-words font-semibold">{item.value}</span></a>)}</div>}{contact.location && <p className="mx-auto mt-5 max-w-3xl text-center text-white/75">Serving: {contact.location}</p>}<div className="relative mx-auto mt-10 max-w-3xl"><InquiryForm slug={slug} services={services.map((item) => item.title)} selectedService={selectedService} /></div></div></section>
    <footer className="bg-[#102A23] px-5 py-10 text-white/65 sm:px-10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row"><div><strong className="text-lg text-white">{snapshot.business.name}</strong>{snapshot.brand?.tagline && <p className="mt-2 max-w-md text-sm">{snapshot.brand.tagline}</p>}</div><nav className="flex flex-wrap gap-5 text-sm">{nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav><p className="text-sm">© {new Date().getUTCFullYear()} {snapshot.business.name}</p></div></footer>
  </main>;
}