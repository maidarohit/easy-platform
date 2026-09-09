import type { CSSProperties, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { PoweredByBuzypeezy } from "@/app/components/PoweredByBuzypeezy";
import { resolveWebsiteMedia, type WebsiteMediaInput, type ResolvedWebsiteMedia } from "@/app/lib/business-site-visuals";
import { publicWebsitePageBlocks, resolvePublishedWebsitePage, resolveWebsiteSitePage, safeWebsiteBlockText, visibleWebsiteNavigation } from "@/app/lib/website-site-presentation";
import { validateWebsiteSiteDocument, type WebsiteBlock, type WebsitePage, type WebsiteSiteDocument } from "@/app/lib/website-site-document";
import WebsiteMediaVisual from "./WebsiteMediaVisual";
import { websiteThemes } from "./websiteThemes";
import { websiteMediaReference } from "@/app/lib/website-essential-pages";
import { publicContactMethods, validatePublicContactSettings, type PublicContactSettings } from "@/app/lib/public-contact";

function firstHex(value: string) {
  return value.match(/#[0-9a-f]{6}\b/i)?.[0];
}

function readableTextColor(background: string) {
  const value = Number.parseInt(background.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}

type SiteService = { id: string; title: string; body: string; path: string };
export type WebsiteSiteServiceItem = { id: string; title: string; description?: string | null; path?: string | null };
type BlockProps = { block: WebsiteBlock; media: ResolvedWebsiteMedia; accent: string; accentText: string; basePath: string; services: SiteService[]; fallbackHeadline: string; fallbackDescription: string; pagePath: string; secondaryHref: string | null; contact: PublicContactSettings };

function siteHref(href: string, basePath: string) {
  if (!href.startsWith("/") || !basePath) return href;
  return href === "/" ? basePath : `${basePath}${href}`;
}

function SiteLink({ href, basePath, className, style, onNavigate, children }: { href: string; basePath: string; className?: string; style?: CSSProperties; onNavigate?: (path: string) => void; children: ReactNode }) {
  const resolved = siteHref(href, basePath);
  const onClick = onNavigate && href.startsWith("/") ? (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); onNavigate(href); } : undefined;
  return resolved.startsWith("/")
    ? <Link href={resolved} className={className} style={style} onClick={onClick}>{children}</Link>
    : <a href={resolved} className={className} style={style} onClick={onClick}>{children}</a>;
}

function Section({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <section className={muted ? "border-y border-slate-200/70 bg-slate-500/[0.07] px-5 py-16 sm:px-8 sm:py-20 lg:px-12" : "px-5 py-16 sm:px-8 sm:py-20 lg:px-12"}>{children}</section>;
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">{children}</h2>;
}

function HeroBlock({ block, media, accent, accentText, basePath, fallbackHeadline, fallbackDescription, secondaryHref }: BlockProps & { block: Extract<WebsiteBlock, { type: "hero" }> }) {
  const headline = safeWebsiteBlockText(block.headline, 200), description = safeWebsiteBlockText(block.description, 650) || fallbackDescription;
  const label = safeWebsiteBlockText(block.ctaLabel, 100);
  return <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28" style={!media.hero ? { background: `linear-gradient(145deg, ${accent}18, transparent 68%)` } : undefined}><div data-block-type="hero" className={`mx-auto grid max-w-7xl items-center gap-10 lg:gap-16 ${media.hero ? "lg:grid-cols-[1.05fr_.95fr]" : ""}`}><div className={media.hero ? "" : "max-w-4xl"}>
    <h1 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">{headline || fallbackHeadline}</h1>
    {description && <p className="mt-5 max-w-2xl text-lg leading-8 opacity-75">{description}</p>}
    <div className="mt-8 flex flex-wrap gap-3">{label && <SiteLink href={block.ctaHref} basePath={basePath} className="inline-flex min-h-12 items-center px-7 py-3 font-semibold shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ backgroundColor: accent, color: accentText, borderRadius: "0.75rem" }}>{label}</SiteLink>}{secondaryHref && <SiteLink href={secondaryHref} basePath={basePath} className="inline-flex min-h-12 items-center rounded-xl border border-current px-7 py-3 font-semibold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2">Explore services</SiteLink>}</div>
  </div>{media.hero && <WebsiteMediaVisual media={media.hero} className="aspect-[4/3] min-h-72 rounded-[2rem] shadow-xl" />}</div></section>;
}

function ContentBlock({ block, fallbackDescription, pagePath }: BlockProps & { block: Extract<WebsiteBlock, { type: "content" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body) || (pagePath === "/" ? fallbackDescription : "");
  if (!body) return null;
  return <Section muted><div data-block-type="content" className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[.7fr_1.3fr] lg:gap-14">{heading && <Heading>{heading}</Heading>}<p className="max-w-3xl whitespace-pre-wrap text-lg leading-8 opacity-75">{body}</p></div></Section>;
}

function ServicesBlock({ block, media, services, accent, basePath, pagePath }: BlockProps & { block: Extract<WebsiteBlock, { type: "services" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), introduction = safeWebsiteBlockText(block.introduction);
  if (!heading && !introduction && media.services.length === 0 && services.length === 0) return null;
  return <Section><div data-block-type="services" className="mx-auto max-w-7xl">{heading && <Heading>{heading}</Heading>}{introduction && <p className="mt-5 max-w-3xl text-lg leading-8 opacity-75">{introduction}</p>}
    {services.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.slice(0, pagePath === "/" ? 6 : services.length).map((service) => <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><h3 className="text-xl font-bold">{service.title}</h3>{service.body && <p className="mt-3 line-clamp-4 leading-7 text-slate-600">{service.body}</p>}<SiteLink href={service.path} basePath={basePath} className="mt-6 inline-flex min-h-11 items-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2" style={{ color: accent }}>Learn more <span aria-hidden="true" className="ml-2">→</span></SiteLink></article>)}</div>}
    {media.services.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2">{media.services.map((item) => <WebsiteMediaVisual key={item.src} media={item} className="aspect-[4/3] min-h-64 rounded-2xl" />)}</div>}
    {pagePath === "/" && services.length > 0 && <div data-home-value-section className="mt-14 rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-lg sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Why choose us</p><h3 className="mt-3 text-3xl font-bold tracking-tight">A coordinated approach to your project</h3><div className="mt-8 grid gap-5 md:grid-cols-3">{services.slice(0, 3).map((service) => <div key={`value-${service.id}`} className="rounded-2xl border border-white/15 bg-white/5 p-5"><h4 className="font-semibold">{service.title}</h4><p className="mt-2 text-sm leading-6 text-white/65">{service.body || `Discuss ${service.title.toLowerCase()} around your confirmed requirements.`}</p></div>)}</div></div>}
  </div></Section>;
}

function ServiceDetailBlock({ block }: BlockProps & { block: Extract<WebsiteBlock, { type: "serviceDetail" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body);
  if (!heading && !body) return null;
  return <Section muted><article data-block-type="serviceDetail" className="mx-auto max-w-4xl">{heading && <Heading>{heading}</Heading>}{body && <p className="mt-5 text-lg leading-8 opacity-75">{body}</p>}</article></Section>;
}

function GalleryBlock({ block, media }: BlockProps & { block: Extract<WebsiteBlock, { type: "gallery" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200);
  const available = [...media.work, ...media.services];
  const selected = block.mediaIds.length > 0 ? available.filter((item) => block.mediaIds.includes(websiteMediaReference(item.src))) : media.work;
  if (selected.length === 0) return null;
  return <Section><div data-block-type="gallery" className="mx-auto max-w-6xl">{heading && <Heading>{heading}</Heading>}{selected.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{selected.map((item) => <WebsiteMediaVisual key={item.src} media={item} className="min-h-64 rounded-2xl" />)}</div>}</div></Section>;
}

function ProcessBlock({ block, accent }: BlockProps & { block: Extract<WebsiteBlock, { type: "process" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200);
  const savedSteps = block.steps.map((step) => ({ ...step, title: safeWebsiteBlockText(step.title, 200), body: safeWebsiteBlockText(step.body) })).filter((step) => step.title || step.body);
  const steps = savedSteps.length > 0 ? savedSteps.slice(0, 4) : [
    { id: "generic-enquiry", title: "Start with an enquiry", body: "Share what you need and the questions you would like to discuss." },
    { id: "generic-requirements", title: "Clarify requirements", body: "Review the priorities and service direction for the project." },
    { id: "generic-plan", title: "Plan the approach", body: "Confirm the practical next steps before work moves forward." },
    { id: "generic-next-step", title: "Move ahead", body: "Continue with the agreed service and next step." },
  ];
  if (!heading && steps.length === 0) return null;
  return <Section muted><div data-block-type="process" className="mx-auto max-w-7xl">{heading && <Heading>{heading}</Heading>}<ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step.id} className="rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-sm"><span className="text-sm font-bold" style={{ color: accent }}>{String(index + 1).padStart(2, "0")}</span>{step.title && <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>}{step.body && <p className="mt-3 leading-7 text-slate-600">{step.body}</p>}</li>)}</ol></div></Section>;
}

function FaqBlock({ block, services, contact }: BlockProps & { block: Extract<WebsiteBlock, { type: "faq" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200);
  const savedItems = block.items.map((item) => ({ ...item, question: safeWebsiteBlockText(item.question, 300), answer: safeWebsiteBlockText(item.answer) })).filter((item) => item.question && item.answer);
  const items = savedItems.length > 0 ? savedItems : [
    ...(services.length > 0 ? [{ id: "verified-services", question: "What services are available?", answer: `Available services include ${services.slice(0, 6).map((item) => item.title).join(", ")}.` }] : []),
    ...(services.some((item) => /\b3d\b|visuali[sz]ation|walkthrough/i.test(item.title)) ? [{ id: "verified-visualisation", question: "Is 3D visualisation available?", answer: "Yes. 3D visualisation is included in the verified services offered." }] : []),
    ...(contact.location ? [{ id: "verified-location", question: "Where is the business located?", answer: `The verified service location is ${contact.location}.` }] : []),
    ...(publicContactMethods(contact).length > 0 ? [{ id: "verified-contact", question: "How can I enquire?", answer: "Use one of the approved contact methods on the Contact page to discuss your requirements." }] : []),
  ];
  if (items.length === 0) return null;
  return <Section><div data-block-type="faq" className="mx-auto max-w-4xl">{heading && <Heading>{heading}</Heading>}<div className="mt-8 space-y-4">{items.map((item) => <details key={item.id} className="rounded-xl border border-slate-200 p-5"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 leading-7 opacity-75">{item.answer}</p></details>)}</div></div></Section>;
}

function ContactBlock({ block, contact, services, accent }: BlockProps & { block: Extract<WebsiteBlock, { type: "contact" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body);
  const methods = publicContactMethods(contact);
  return <Section muted><div data-block-type="contact" id="contact" className="mx-auto max-w-6xl rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-900 shadow-sm sm:p-12">{heading && <Heading>{heading}</Heading>}<p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{body || "Tell us what you are looking for and we can discuss the right next step."}</p>{(methods.length > 0 || contact.location) && <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{methods.map((item) => <a key={item.href} href={item.href} className="rounded-2xl border border-slate-200 p-5 transition hover:shadow-md"><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</span><span className="mt-2 block break-words font-semibold" style={{ color: accent }}>{item.value}</span></a>)}{contact.location && <div className="rounded-2xl border border-slate-200 p-5"><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Location</span><span className="mt-2 block font-semibold">{contact.location}</span></div>}</div>}{services.length > 0 && <p className="mt-8 text-sm text-slate-500">Enquiries are welcome for {services.slice(0, 4).map((item) => item.title).join(", ")}.</p>}</div></Section>;
}

function CtaBlock({ block, accent, accentText, basePath }: BlockProps & { block: Extract<WebsiteBlock, { type: "cta" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body), label = safeWebsiteBlockText(block.label, 100);
  if (!heading && !body && !label) return null;
  return <Section><div data-block-type="cta" className="mx-auto max-w-5xl rounded-3xl bg-slate-950 px-8 py-12 text-center text-white">{heading && <Heading>{heading}</Heading>}{body && <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">{body}</p>}{label && <SiteLink href={block.href} basePath={basePath} className="mt-7 inline-flex px-6 py-3 font-semibold" style={{ backgroundColor: accent, color: accentText, borderRadius: "0.75rem" }}>{label}</SiteLink>}</div></Section>;
}

export function WebsiteBlockRenderer(props: BlockProps) {
  if (props.block.visibility === "hidden") return null;
  switch (props.block.type) {
    case "hero": return <HeroBlock {...props} block={props.block} />;
    case "content": return <ContentBlock {...props} block={props.block} />;
    case "services": return <ServicesBlock {...props} block={props.block} />;
    case "serviceDetail": return <ServiceDetailBlock {...props} block={props.block} />;
    case "gallery": return <GalleryBlock {...props} block={props.block} />;
    case "process": return <ProcessBlock {...props} block={props.block} />;
    case "faq": return <FaqBlock {...props} block={props.block} />;
    case "contact": return <ContactBlock {...props} block={props.block} />;
    case "cta": return <CtaBlock {...props} block={props.block} />;
  }
}

function PageIntro({ title, description, accent }: { title: string; description: string; accent: string }) {
  return <section className="border-b border-slate-200/70 bg-slate-500/[0.07] px-5 py-14 sm:px-8 sm:py-20 lg:px-12"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>Explore</p><h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-6xl">{title}</h1>{description && <p className="mt-5 max-w-2xl text-lg leading-8 opacity-70">{description}</p>}</div></section>;
}

function PageEmptyState({ type, contactHref, basePath, accent }: { type: WebsitePage["type"]; contactHref: string; basePath: string; accent: string }) {
  const copy = type === "portfolio" || type === "project"
    ? "Verified project work will be presented here when it is available."
    : type === "faq" ? "Have a question about your project? Contact us for the information you need."
    : type === "services" || type === "service" ? "Contact us to discuss the service that best fits your needs."
    : null;
  if (!copy) return null;
  return <section className="px-5 py-12 sm:px-8 sm:py-16 lg:px-12"><div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-900 shadow-sm"><p className="mx-auto max-w-2xl leading-7 text-slate-600">{copy}</p><SiteLink href={contactHref} basePath={basePath} className="mt-6 inline-flex min-h-11 items-center font-semibold focus-visible:outline-none focus-visible:ring-2" style={{ color: accent }}>Contact us</SiteLink></div></section>;
}

export default function WebsiteSiteRenderer({ document, pagePath = "/", basePath = "", industry = "", description = "", media: uploadedMedia, serviceItems = [], contact: suppliedContact = {}, preview = false, publicPageOnly = false, onNavigate }: { document: WebsiteSiteDocument; pagePath?: string; basePath?: string; industry?: string; description?: string; media?: WebsiteMediaInput; serviceItems?: readonly WebsiteSiteServiceItem[]; contact?: PublicContactSettings; preview?: boolean; publicPageOnly?: boolean; onNavigate?: (path: string) => void }) {
  const validated = validateWebsiteSiteDocument(document), page = validated && (publicPageOnly ? resolvePublishedWebsitePage(validated, pagePath) : resolveWebsiteSitePage(validated, pagePath, preview));
  if (!validated || !page) return null;
  const baseTheme = websiteThemes[validated.theme.template] || websiteThemes.Modern;
  const accent = firstHex(validated.theme.colorPalette) || baseTheme.primaryColor;
  const accentText = readableTextColor(accent);
  const font = validated.theme.typography.split(/[,;\n]|\s+and\s+/i)[0]?.replace(/[^a-zA-Z0-9 '-]/g, "").trim();
  const shellStyle: CSSProperties = { backgroundColor: baseTheme.pageBackground, color: baseTheme.textColor, fontFamily: font ? `'${font}', sans-serif` : baseTheme.bodyFont };
  const pages = new Map(validated.pages.map((item) => [item.id, item]));
  const navigation = visibleWebsiteNavigation(validated);
  const pageBlocks = publicWebsitePageBlocks(validated, page.path, !publicPageOnly && preview);
  const pageServices = validated.pages.filter((item) => item.type === "service" && item.visibility === "visible").map((item): SiteService | null => {
    const detail = item.blocks.find((block): block is Extract<WebsiteBlock, { type: "serviceDetail" }> => block.type === "serviceDetail" && block.visibility === "visible");
    const title = safeWebsiteBlockText(detail?.heading || item.title, 160);
    return title ? { id: item.id, title, body: safeWebsiteBlockText(detail?.body || "", 500), path: item.path } : null;
  }).filter((item): item is SiteService => Boolean(item));
  const suppliedServices = serviceItems.map((item): SiteService | null => {
    const title = safeWebsiteBlockText(item.title, 160), body = safeWebsiteBlockText(item.description || "", 500);
    if (!title) return null;
    const serviceSlug = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const matchedPage = validated.pages.find((page) => page.type === "service" && page.visibility === "visible" && (page.id === item.id || page.path === item.path || page.path === `/services/${serviceSlug}`));
    const contactPath = validated.pages.find((page) => page.type === "contact" && page.visibility === "visible")?.path || "/";
    return { id: item.id, title, body, path: matchedPage?.path || contactPath };
  }).filter((item): item is SiteService => Boolean(item));
  const services = pageServices.length > 0 ? pageServices : suppliedServices;
  const checkedContact = validatePublicContactSettings(suppliedContact);
  const contact = checkedContact.valid ? checkedContact.settings : {};
  const resolvedMedia = resolveWebsiteMedia({ industry, description, uploaded: uploadedMedia });
  const brandLabel = safeWebsiteBlockText(validated.header.brandLabel, 200) || safeWebsiteBlockText(validated.branding.name, 200) || "Business";
  const fallbackHeadline = page.path === "/" ? brandLabel : (safeWebsiteBlockText(page.title, 200) || "Explore");
  const pageDescription = safeWebsiteBlockText(page.seo.description, 165);
  const fallbackDescription = safeWebsiteBlockText(description, 650);
  const headerCta = safeWebsiteBlockText(validated.header.ctaLabel, 100);
  const secondaryHref = validated.pages.find((item) => item.type === "services" && item.visibility === "visible")?.path
    ?? validated.pages.find((item) => item.type === "portfolio" && item.visibility === "visible")?.path ?? null;
  const contactHref = validated.pages.find((item) => item.type === "contact" && item.visibility === "visible")?.path
    ?? (pageBlocks.some((block) => block.type === "contact" && block.visibility === "visible") ? "#contact" : "/");
  const hasPageContent = pageBlocks.some((block) => {
    if (block.type === "gallery") return resolvedMedia.work.length > 0 || resolvedMedia.services.length > 0;
    if (block.type === "faq") return block.items.some((item) => Boolean(safeWebsiteBlockText(item.question)) && Boolean(safeWebsiteBlockText(item.answer)));
    if (block.type === "services") return services.length > 0 || Boolean(safeWebsiteBlockText(block.introduction)) || resolvedMedia.services.length > 0;
    return true;
  });
  return <div data-site-document-version="2" data-page-path={page.path} className="min-h-full overflow-hidden" style={shellStyle}>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
      <SiteLink href="/" basePath={basePath} onNavigate={onNavigate} className="text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2">{brandLabel}</SiteLink>
      <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">{navigation.map((item) => { const href = pages.get(item.pageId)!.path; return <SiteLink key={item.id} href={href} basePath={basePath} onNavigate={onNavigate} className={`border-b-2 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${href === page.path ? "border-current opacity-100" : "border-transparent opacity-65 hover:opacity-100"}`}>{safeWebsiteBlockText(item.label, 100)}</SiteLink>; })}</nav>
      {headerCta && <SiteLink href={publicPageOnly ? contactHref : validated.header.ctaHref} basePath={basePath} className="px-4 py-2 text-sm font-semibold" style={{ backgroundColor: accent, color: accentText, borderRadius: baseTheme.buttonRadius }}>{headerCta}</SiteLink>}
    </div><nav aria-label="Mobile navigation" className="mx-auto mt-3 flex max-w-7xl gap-5 overflow-x-auto pb-1 md:hidden">{navigation.map((item) => { const href = pages.get(item.pageId)!.path; return <SiteLink key={item.id} href={href} basePath={basePath} onNavigate={onNavigate} className={`shrink-0 py-1 text-sm font-semibold ${href === page.path ? "opacity-100" : "opacity-60"}`}>{safeWebsiteBlockText(item.label, 100)}</SiteLink>; })}</nav></header>
    <main>{page.path !== "/" && <PageIntro title={fallbackHeadline} description={pageDescription} accent={accent} />}{[...pageBlocks].sort((a, b) => a.order - b.order).map((block) => <WebsiteBlockRenderer key={block.id} block={block} media={resolvedMedia} accent={accent} accentText={accentText} basePath={basePath} services={services} fallbackHeadline={fallbackHeadline} fallbackDescription={fallbackDescription} pagePath={page.path} secondaryHref={secondaryHref} contact={contact} />)}{page.path !== "/" && !hasPageContent && <PageEmptyState type={page.type} contactHref={contactHref} basePath={basePath} accent={accent} />}</main>
    <footer className="border-t border-slate-200 bg-slate-950 px-5 py-12 text-white sm:px-8 lg:px-12"><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_1fr_auto]"><div><p className="text-lg font-semibold">{safeWebsiteBlockText(validated.footer.businessName, 200) || brandLabel}</p>{safeWebsiteBlockText(validated.footer.description, 650) && <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{safeWebsiteBlockText(validated.footer.description, 650)}</p>}</div><nav aria-label="Footer navigation" className="flex flex-wrap content-start gap-x-5 gap-y-3 text-sm">{navigation.map((item) => <SiteLink key={item.id} href={pages.get(item.pageId)!.path} basePath={basePath} onNavigate={onNavigate} className="text-slate-300 hover:text-white">{safeWebsiteBlockText(item.label, 100)}</SiteLink>)}</nav>{validated.footer.showContact && <SiteLink href={contactHref} basePath={basePath} className="text-sm font-semibold text-white">Contact</SiteLink>}</div><PoweredByBuzypeezy className="mx-auto mt-8 max-w-7xl text-xs text-slate-400" /></footer>
  </div>;
}
