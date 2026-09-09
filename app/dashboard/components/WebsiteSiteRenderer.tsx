import type { CSSProperties, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { PoweredByBuzypeezy } from "@/app/components/PoweredByBuzypeezy";
import { resolveWebsiteMedia, type WebsiteMediaInput, type ResolvedWebsiteMedia } from "@/app/lib/business-site-visuals";
import { publicWebsitePageBlocks, resolvePublishedWebsitePage, resolveWebsiteSitePage, safeWebsiteBlockText, visibleWebsiteNavigation } from "@/app/lib/website-site-presentation";
import { validateWebsiteSiteDocument, type WebsiteBlock, type WebsiteSiteDocument } from "@/app/lib/website-site-document";
import WebsiteMediaVisual from "./WebsiteMediaVisual";
import { websiteThemes } from "./websiteThemes";
import { websiteMediaReference } from "@/app/lib/website-essential-pages";

function firstHex(value: string) {
  return value.match(/#[0-9a-f]{6}\b/i)?.[0];
}

function readableTextColor(background: string) {
  const value = Number.parseInt(background.slice(1), 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}

type BlockProps = { block: WebsiteBlock; media: ResolvedWebsiteMedia; accent: string; accentText: string; basePath: string };

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
  return <section className={muted ? "bg-slate-500/10 px-6 py-14 sm:px-10 lg:px-16" : "px-6 py-14 sm:px-10 lg:px-16"}>{children}</section>;
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{children}</h2>;
}

function HeroBlock({ block, media, accent, accentText, basePath }: BlockProps & { block: Extract<WebsiteBlock, { type: "hero" }> }) {
  const headline = safeWebsiteBlockText(block.headline, 200), description = safeWebsiteBlockText(block.description, 650);
  const label = safeWebsiteBlockText(block.ctaLabel, 100);
  if (!headline && !description) return null;
  return <Section><div data-block-type="hero" className="grid items-center gap-10 lg:grid-cols-2"><div>
    {headline && <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{headline}</h1>}
    {description && <p className="mt-5 max-w-2xl text-lg leading-8 opacity-75">{description}</p>}
    {label && <SiteLink href={block.ctaHref} basePath={basePath} className="mt-7 inline-flex px-6 py-3 font-semibold" style={{ backgroundColor: accent, color: accentText, borderRadius: "0.75rem" }}>{label}</SiteLink>}
  </div>{media.hero && <WebsiteMediaVisual media={media.hero} className="min-h-72 rounded-3xl" />}</div></Section>;
}

function ContentBlock({ block }: BlockProps & { block: Extract<WebsiteBlock, { type: "content" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body);
  if (!heading && !body) return null;
  return <Section muted><div data-block-type="content" className="mx-auto max-w-4xl">{heading && <Heading>{heading}</Heading>}{body && <p className="mt-5 whitespace-pre-wrap text-lg leading-8 opacity-75">{body}</p>}</div></Section>;
}

function ServicesBlock({ block, media }: BlockProps & { block: Extract<WebsiteBlock, { type: "services" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), introduction = safeWebsiteBlockText(block.introduction);
  if (!heading && !introduction && media.services.length === 0) return null;
  return <Section><div data-block-type="services" className="mx-auto max-w-6xl">{heading && <Heading>{heading}</Heading>}{introduction && <p className="mt-5 max-w-3xl text-lg leading-8 opacity-75">{introduction}</p>}
    {media.services.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2">{media.services.map((item) => <WebsiteMediaVisual key={item.src} media={item} className="min-h-64 rounded-2xl" />)}</div>}
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
  if (!heading && selected.length === 0) return null;
  return <Section><div data-block-type="gallery" className="mx-auto max-w-6xl">{heading && <Heading>{heading}</Heading>}{selected.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{selected.map((item) => <WebsiteMediaVisual key={item.src} media={item} className="min-h-64 rounded-2xl" />)}</div>}</div></Section>;
}

function ProcessBlock({ block, accent }: BlockProps & { block: Extract<WebsiteBlock, { type: "process" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200);
  const steps = block.steps.map((step) => ({ ...step, title: safeWebsiteBlockText(step.title, 200), body: safeWebsiteBlockText(step.body) })).filter((step) => step.title || step.body);
  if (!heading && steps.length === 0) return null;
  return <Section muted><div data-block-type="process" className="mx-auto max-w-6xl">{heading && <Heading>{heading}</Heading>}<ol className="mt-8 grid gap-5 md:grid-cols-3">{steps.map((step, index) => <li key={step.id} className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900"><span className="text-sm font-bold" style={{ color: accent }}>{index + 1}</span>{step.title && <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>}{step.body && <p className="mt-3 leading-7 text-slate-600">{step.body}</p>}</li>)}</ol></div></Section>;
}

function FaqBlock({ block }: BlockProps & { block: Extract<WebsiteBlock, { type: "faq" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200);
  const items = block.items.map((item) => ({ ...item, question: safeWebsiteBlockText(item.question, 300), answer: safeWebsiteBlockText(item.answer) })).filter((item) => item.question && item.answer);
  if (!heading && items.length === 0) return null;
  return <Section><div data-block-type="faq" className="mx-auto max-w-4xl">{heading && <Heading>{heading}</Heading>}<div className="mt-8 space-y-4">{items.map((item) => <details key={item.id} className="rounded-xl border border-slate-200 p-5"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 leading-7 opacity-75">{item.answer}</p></details>)}</div></div></Section>;
}

function ContactBlock({ block }: BlockProps & { block: Extract<WebsiteBlock, { type: "contact" }> }) {
  const heading = safeWebsiteBlockText(block.heading, 200), body = safeWebsiteBlockText(block.body);
  if (!heading && !body) return null;
  return <Section muted><div data-block-type="contact" id="contact" className="mx-auto max-w-4xl">{heading && <Heading>{heading}</Heading>}{body && <p className="mt-5 text-lg leading-8 opacity-75">{body}</p>}</div></Section>;
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

export default function WebsiteSiteRenderer({ document, pagePath = "/", basePath = "", industry = "", description = "", media: uploadedMedia, preview = false, publicPageOnly = false, onNavigate }: { document: WebsiteSiteDocument; pagePath?: string; basePath?: string; industry?: string; description?: string; media?: WebsiteMediaInput; preview?: boolean; publicPageOnly?: boolean; onNavigate?: (path: string) => void }) {
  const validated = validateWebsiteSiteDocument(document), page = validated && (publicPageOnly ? resolvePublishedWebsitePage(validated, pagePath) : resolveWebsiteSitePage(validated, pagePath, preview));
  if (!validated || !page) return null;
  const baseTheme = websiteThemes[validated.theme.template] || websiteThemes.Modern;
  const accent = firstHex(validated.theme.colorPalette) || baseTheme.primaryColor;
  const accentText = readableTextColor(accent);
  const font = validated.theme.typography.split(/[,;\n]|\s+and\s+/i)[0]?.replace(/[^a-zA-Z0-9 '-]/g, "").trim();
  const shellStyle: CSSProperties = { backgroundColor: baseTheme.pageBackground, color: baseTheme.textColor, fontFamily: font ? `'${font}', sans-serif` : baseTheme.bodyFont };
  const pages = new Map(validated.pages.map((item) => [item.id, item]));
  const navigation = visibleWebsiteNavigation(validated);
  const pageBlocks = publicPageOnly ? publicWebsitePageBlocks(validated, page.path) : page.blocks;
  const resolvedMedia = resolveWebsiteMedia({ industry, description, uploaded: uploadedMedia });
  const brandLabel = safeWebsiteBlockText(validated.header.brandLabel, 200) || safeWebsiteBlockText(validated.branding.name, 200) || "Business";
  const headerCta = safeWebsiteBlockText(validated.header.ctaLabel, 100);
  const contactHref = validated.pages.find((item) => item.type === "contact" && item.visibility === "visible")?.path
    ?? (pageBlocks.some((block) => block.type === "contact" && block.visibility === "visible") ? "#contact" : "/");
  return <div data-site-document-version="2" data-page-path={page.path} className="min-h-full overflow-hidden" style={shellStyle}>
    <header className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-5 sm:px-10 lg:px-16">
      <SiteLink href="/" basePath={basePath} onNavigate={onNavigate} className="text-xl font-bold">{brandLabel}</SiteLink>
      <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">{navigation.map((item) => <SiteLink key={item.id} href={pages.get(item.pageId)!.path} basePath={basePath} onNavigate={onNavigate} className="text-sm font-medium opacity-75 hover:opacity-100">{safeWebsiteBlockText(item.label, 100)}</SiteLink>)}</nav>
      {headerCta && <SiteLink href={publicPageOnly ? contactHref : validated.header.ctaHref} basePath={basePath} className="px-4 py-2 text-sm font-semibold" style={{ backgroundColor: accent, color: accentText, borderRadius: baseTheme.buttonRadius }}>{headerCta}</SiteLink>}
    </header>
    <main>{[...pageBlocks].sort((a, b) => a.order - b.order).map((block) => <WebsiteBlockRenderer key={block.id} block={block} media={resolvedMedia} accent={accent} accentText={accentText} basePath={basePath} />)}</main>
    <footer className="border-t border-slate-200 px-6 py-10 sm:px-10 lg:px-16"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-semibold">{safeWebsiteBlockText(validated.footer.businessName, 200) || brandLabel}</p>{safeWebsiteBlockText(validated.footer.description, 650) && <p className="mt-2 max-w-xl text-sm leading-6 opacity-70">{safeWebsiteBlockText(validated.footer.description, 650)}</p>}</div>{validated.footer.showContact && <SiteLink href={contactHref} basePath={basePath} className="text-sm font-semibold" style={{ color: accent }}>Contact</SiteLink>}</div><PoweredByBuzypeezy className="mt-5 text-xs opacity-60" /></footer>
  </div>;
}
