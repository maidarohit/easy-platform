"use client";

import AnimatedButton from "../animations/AnimatedButton";
import FadeIn from "../animations/FadeIn";
import SlideUp from "../animations/SlideUp";
import WebsiteMediaVisual from "../WebsiteMediaVisual";
import type { ResolvedWebsiteMedia } from "@/app/lib/business-site-visuals";

type RealEstateTemplateProps = {
  companyName: string;
  websiteGoal: string;
  websiteStyle: string;
  websiteRequirements?: string;
  previewMode?: "desktop" | "tablet" | "mobile";
  brandResult?: {
    heroHeadline?: string;
    websiteOverview?: string;
    websiteGoal?: string;
    websiteFeatures?: string;
    designRecommendations?: string;
  };
  labels: {
    home: string;
    services: string;
    about: string;
    contact: string;
    howWeCanHelp: string;
  };
  media: ResolvedWebsiteMedia;
};

export default function RealEstateTemplate({
  companyName,
  websiteGoal,
  websiteStyle,
  websiteRequirements,
  previewMode = "desktop",
  brandResult,
  labels,
  media,
}: RealEstateTemplateProps) {
  const businessName = companyName || "—";
  const isLuxury = websiteStyle === "Luxury";
  const accent = isLuxury ? "#c9a35c" : "#b9925a";
  const compactPreview = previewMode !== "desktop";
  const mobilePreview = previewMode === "mobile";
  const headline =
    brandResult?.heroHeadline ||
    businessName;
  const description =
    websiteRequirements?.trim() ||
    brandResult?.websiteOverview ||
    businessName;

  const amenities = [
    ["01", labels.services, brandResult?.websiteFeatures || description],
    ["02", labels.about, brandResult?.designRecommendations || description],
    ["03", labels.howWeCanHelp, description],
    ["04", labels.contact, description],
  ];

  return (
    <div className="overflow-hidden bg-[#0b0b0a] text-[#f3efe6]">
      <nav className={compactPreview ? "flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur-xl" : "flex items-center justify-between border-b border-white/10 bg-black/70 px-12 py-5 backdrop-blur-xl"}>
        <div className="font-serif text-xl tracking-[0.08em]">{businessName}</div>
        <div className={compactPreview ? "hidden" : "flex items-center gap-7 text-[10px] uppercase tracking-[0.2em] text-[#c9c1b3]"}>
          {[labels.home, labels.services, labels.about, labels.contact].map((item) => <span key={item}>{item}</span>)}
        </div>
        <button className="border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:bg-[#c9a35c] hover:text-black" style={{ borderColor: accent, color: accent }}>{labels.contact}</button>
      </nav>

      <section className={compactPreview ? "relative overflow-hidden px-7 py-16" : media.hero ? "relative min-h-[760px] overflow-hidden px-12 py-28" : "relative overflow-hidden px-12 py-28"}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_26%,rgba(201,163,92,0.16),transparent_28%),linear-gradient(135deg,#0a0a09_0%,#14120f_48%,#080808_100%)]" />
        <div className={compactPreview ? "relative z-10" : media.hero ? "relative z-10 max-w-[58%] pt-10" : "relative z-10 max-w-4xl"}>
          <SlideUp><p className="text-[10px] font-semibold uppercase tracking-[0.34em]" style={{ color: accent }}>{labels.about}</p></SlideUp>
          <FadeIn delay={0.15}><h1 className={mobilePreview ? "mt-6 font-serif text-4xl leading-[1.05] tracking-[-0.035em]" : "mt-7 max-w-3xl font-serif text-5xl leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl"}>{headline}</h1></FadeIn>
          <FadeIn delay={0.3}><p className="mt-7 max-w-xl whitespace-pre-wrap break-words text-base leading-8 text-[#b9b0a2]">{description}</p></FadeIn>
          <div className="mt-10 flex flex-wrap gap-4">
            <AnimatedButton><span className="inline-flex px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-black" style={{ backgroundColor: accent }}>{websiteGoal || labels.contact}</span></AnimatedButton>
            <AnimatedButton className="border border-white/25 bg-black/25 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white">{labels.contact}</AnimatedButton>
          </div>
          <div className="mt-14 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">
            {[['01', labels.services], ['02', labels.about], ['03', labels.contact]].map(([value, label]) => <div key={label}><p className="font-serif text-2xl" style={{ color: accent }}>{value}</p><p className="mt-2 text-[9px] uppercase tracking-[0.18em] text-[#8d8579]">{label}</p></div>)}
          </div>
        </div>

        {media.hero && (
          <WebsiteMediaVisual
            media={media.hero}
            className={compactPreview ? "relative z-10 mt-12 h-[420px] border border-white/10 shadow-[0_35px_90px_rgba(0,0,0,0.55)]" : "absolute right-[6%] top-[9%] h-[68%] w-[46%] border border-white/10 shadow-[0_50px_120px_rgba(0,0,0,0.55)]"}
          />
        )}
      </section>

      <section className="border-y border-white/10 bg-[#11100e] px-7 py-20 lg:px-12">
        <div className={compactPreview ? "flex flex-col gap-5" : "flex items-end justify-between gap-5"}><div><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>{labels.services}</p><h2 className="mt-4 font-serif text-4xl sm:text-5xl">{headline}</h2></div><p className="max-w-md text-sm leading-7 text-[#91897e]">{description}</p></div>
      </section>

      <section className="px-7 py-24 lg:px-12">
        <div className={compactPreview ? "grid gap-12" : "grid grid-cols-[0.8fr_1.2fr] gap-12"}><div><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>{labels.services}</p><h2 className="mt-5 max-w-lg font-serif text-4xl leading-tight sm:text-5xl">{headline}</h2><p className="mt-6 max-w-md whitespace-pre-wrap break-words leading-8 text-[#91897e]">{brandResult?.websiteFeatures || description}</p></div><div className={compactPreview ? "grid gap-px border border-white/10 bg-white/10" : "grid grid-cols-2 gap-px border border-white/10 bg-white/10"}>{amenities.map(([number,title,text]) => <div key={number} className="bg-[#11100e] p-7"><span className="font-serif text-xl" style={{ color: accent }}>{number}</span><h3 className="mt-7 font-serif text-2xl">{title}</h3><p className="mt-4 text-sm leading-7 text-[#91897e]">{text}</p></div>)}</div></div>
      </section>

      <section className="border-y border-white/10 bg-[#f0eadf] px-7 py-20 text-[#17130e] lg:px-12">
        <div><p className="text-[10px] uppercase tracking-[0.3em] text-[#8d6d35]">{labels.about} {businessName}</p><h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">{headline}</h2><p className="mt-6 whitespace-pre-wrap break-words leading-8 text-[#625a4f]">{brandResult?.designRecommendations || description}</p><div className="mt-8 grid grid-cols-2 gap-5">{[labels.services, labels.about, labels.howWeCanHelp, labels.contact].map(item => <div key={item} className="border-t border-[#aa9166] pt-4 text-sm font-medium">{item}</div>)}</div></div>
      </section>

      <section className="px-7 py-24 text-center lg:px-12"><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>{labels.contact}</p><h2 className="mx-auto mt-5 max-w-4xl font-serif text-5xl leading-tight">{headline}</h2><p className="mx-auto mt-6 max-w-2xl leading-8 text-[#91897e]">{description}</p><button className="mt-9 px-8 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black" style={{ backgroundColor: accent }}>{websiteGoal || labels.contact}</button></section>

      <footer className="flex flex-col gap-6 border-t border-white/10 bg-black px-7 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-12"><div><p className="font-serif text-xl">{businessName}</p><p className="mt-2 text-xs text-[#756e64]">{description.slice(0, 120)}</p></div><div className="text-xs leading-6 text-[#756e64]"><p>{labels.contact}</p><p>{labels.contact} · {labels.services} · {labels.about}</p></div></footer>
    </div>
  );
}
