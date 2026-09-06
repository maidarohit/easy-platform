"use client";
import SlideUp from "../animations/SlideUp";
import FadeIn from "../animations/FadeIn";
import ScaleIn from "../animations/ScaleIn";
import Floating from "../animations/Floating";
import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import type { WebsiteAiOutput } from "../../../lib/ai";
import type { ResolvedWebsiteMedia } from "@/app/lib/business-site-visuals";
import WebsiteMediaVisual from "../WebsiteMediaVisual";

type ModernTemplateProps = {
  companyName: string;
  industry: string;
  websiteGoal: string;
  brandResult?: WebsiteAiOutput & { heroHeadline?: string };
  labels: {
    home: string;
    services: string;
    about: string;
    contact: string;
    howWeCanHelp: string;
  };
  previewMode?: "desktop" | "tablet" | "mobile";
  media: ResolvedWebsiteMedia;
};

export default function ModernTemplate({
  companyName,
  industry,
  websiteGoal,
  brandResult,
  labels,
  media,
}: ModernTemplateProps) {
  const businessName = companyName || industry || "—";

  const headline =
  brandResult?.heroHeadline ||
  `${businessName}${industry ? ` — ${industry}` : ""}`;

  const overview = brandResult?.websiteOverview?.trim() || "";

const description =
  overview.split(/(?<=[.!?])\s+/)[0] ||
  `${businessName} provides professional ${industry || "services"} with a clear, modern and customer-focused experience.`;

  const primaryCta =
  websiteGoal === "Generate Leads"
    ? "Get a Quote"
    : websiteGoal === "Book Appointments"
      ? "Book a Consultation"
      : websiteGoal === "Sell Products"
        ? "Shop Now"
        : websiteGoal === "Showcase Portfolio"
          ? "View Our Work"
          : labels.contact;
          const aboutCopy = description;

const servicesCopy =
  `Explore ${businessName}'s ${industry || "professional"} services and find the right solution for your needs.`;

const contactCopy =
  `Have a project in mind? Contact ${businessName} to discuss your requirements and next steps.`;
  return (
    <div className="overflow-hidden rounded-[28px] bg-white text-slate-950">
      <nav className="flex items-center justify-between border-b border-slate-200 px-8 py-5 lg:px-12">
        <div className="text-xl font-bold tracking-tight">{businessName}</div>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <span>{labels.home}</span>
          <span>{labels.about}</span>
          <span>{labels.services}</span>
          <span>{labels.contact}</span>
        </div>

        <button className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:scale-105">
          {primaryCta}
        </button>
      </nav>

      <section className="relative overflow-hidden px-8 py-20 lg:px-12 lg:py-28">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-200 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-violet-200 blur-3xl" />

        <div className="relative grid items-center gap-16 lg:grid-cols-[1.15fr_0.85fr]">
          <SlideUp>
            <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
              {labels.about}
            </span>

            <FadeIn delay={0.2}>
<h1 className="mt-7 max-w-[680px] text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
              {headline}
            </h1>
            </FadeIn>

            <FadeIn delay={0.4}>
  <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
    {description.slice(0, 220)}
  </p>
</FadeIn>

            <ScaleIn delay={0.6}>
<div className="mt-8 flex flex-wrap gap-4">
    <AnimatedButton className="rounded-full bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition">
  {primaryCta}
</AnimatedButton>
<AnimatedButton className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold transition hover:bg-slate-50">
  {labels.services}
</AnimatedButton>
            </div>

    
          </ScaleIn>
          </SlideUp>

          <div className="relative min-h-[640px]">
  {media.hero && <WebsiteMediaVisual media={media.hero} className="absolute inset-0 z-40 h-full rounded-[40px] shadow-2xl" />}
  {/* Soft background glow */}
  <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-blue-100 via-white to-violet-100" />
  <div className="absolute left-10 top-16 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
  <div className="absolute bottom-10 right-6 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />

  {/* Glass platform */}
  <div className="absolute bottom-10 left-1/2 h-20 w-[78%] -translate-x-1/2 rounded-[50%] border border-white/70 bg-white/40 shadow-2xl backdrop-blur-xl" />

  {/* Phone */}
  <Floating>
  <div className="absolute left-1/2 top-8 z-20 h-[560px] w-[285px] -translate-x-1/2 rotate-[4deg] rounded-[48px] border-[8px] border-slate-950 bg-white shadow-[0_40px_100px_rgba(15,23,42,0.28)]">
    <div className="relative h-full overflow-hidden rounded-[38px] bg-white">
      <div className="absolute left-1/2 top-3 h-7 w-24 -translate-x-1/2 rounded-full bg-slate-950" />

      <div className="px-6 pb-6 pt-14">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">{labels.home}</p>
            <p className="mt-1 font-bold text-slate-950">{businessName}</p>
          </div>

          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500" />
        </div>

        <div className="mt-7 rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/60">{labels.howWeCanHelp}</p>
            
          </div>

          <p className="mt-3 text-xl font-bold">{businessName}</p>

          <div className="mt-6 flex h-28 items-end gap-2">
            {[36, 52, 44, 68, 58, 84, 72, 100].map((height, index) => (
              <div
                key={`${height}-${index}`}
                className="flex-1 rounded-t-full bg-gradient-to-t from-cyan-500 to-violet-400"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <AnimatedCard className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{labels.about}</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{labels.about}</p>
          </AnimatedCard>

          <AnimatedCard className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{labels.services}</p>
            <p className="mt-2 text-xl font-bold text-slate-950">{labels.services}</p>
          </AnimatedCard>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{labels.about}</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {labels.contact}
              </p>
            </div>

            <span className="font-bold text-emerald-500">{labels.contact}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  </Floating>

  {/* Dark brand card */}
  <AnimatedCard className="absolute bottom-24 left-0 z-30 w-60 -rotate-[9deg] rounded-[26px] bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white shadow-2xl">
    <div className="flex items-center justify-between">
      <p className="text-lg font-bold">{businessName}</p>
      <div className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-500" />
    </div>

    <p className="mt-10 text-sm tracking-[0.24em] text-white/90">
  {industry || labels.services}
</p>

    <div className="mt-6 flex items-end justify-between">
      <div>
        <p className="text-[10px] uppercase text-white/40">{labels.about}</p>
        <p className="text-sm">{labels.services}</p>
      </div>

      <p className="text-xl font-bold italic">{labels.contact}</p>
    </div>
  </AnimatedCard>

  {/* Spending card */}
  <AnimatedCard className="absolute right-0 top-24 z-30 w-52 rounded-[26px] border border-white/30 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-xl">
    <p className="text-xs text-white/60">{labels.howWeCanHelp}</p>
    <p className="mt-2 text-xl font-bold">{businessName}</p>

    <div className="mt-5 flex items-center justify-center">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[conic-gradient(#22d3ee_0_45%,#8b5cf6_45%_75%,#2563eb_75%_100%)]">
        <div className="h-16 w-16 rounded-full bg-slate-950" />
      </div>
    </div>

    <div className="mt-5 space-y-2 text-xs text-white/70">
      <div className="flex justify-between">
        <span>{labels.services}</span>
        <span>•</span>
      </div>
      <div className="flex justify-between">
        <span>{labels.contact}</span>
        <span>•</span>
      </div>
      <div className="flex justify-between">
        <span>{labels.about}</span>
        <span>•</span>
      </div>
    </div>
  </AnimatedCard>

  {/* Success card */}
  <AnimatedCard className="absolute bottom-20 right-4 z-30 w-56 rounded-[26px] border border-white/70 bg-white/90 p-5 shadow-2xl backdrop-blur-xl">
    <p className="text-xs font-medium text-slate-400">{labels.howWeCanHelp}</p>
    <div className="mt-2 flex items-end justify-between">
      <p className="text-xl font-bold text-slate-950">{primaryCta}</p>
    </div>

    <div className="mt-6 flex h-16 items-end gap-1">
      {[22, 34, 28, 46, 38, 58, 50, 68, 62, 78].map((height, index) => (
        <div
          key={`${height}-${index}`}
          className="flex-1 rounded-full bg-gradient-to-t from-blue-500 to-cyan-300"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  </AnimatedCard>
</div>
        </div>
      </section>

      <section className="bg-slate-950 px-8 py-20 text-white lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            {labels.services}
          </p>

          <h2 className="mt-4 text-4xl font-bold tracking-tight">
            {headline}
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
  [labels.about, aboutCopy],
  [labels.services, servicesCopy],
  [labels.contact, contactCopy],
].map(([title, text]) => (
            <AnimatedCard
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur"
            >
              <div className="mb-5 h-12 w-12 rounded-2xl bg-cyan-400" />
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{text}</p>
            </AnimatedCard>
          ))}
        </div>
      </section>
      
      <section className="px-8 py-20 text-center lg:px-12">
  <h2 className="text-4xl font-bold tracking-tight">
    Ready to work with {businessName}?
  </h2>

  <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
    {contactCopy}
  </p>

  <button className="mt-8 rounded-full bg-slate-950 px-8 py-4 font-semibold text-white transition hover:scale-105">
    {primaryCta}
  </button>
</section>
    </div>
  );
}
