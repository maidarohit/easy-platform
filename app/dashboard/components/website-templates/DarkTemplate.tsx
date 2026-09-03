"use client";
import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import Floating from "../animations/Floating";
import type { WebsiteAiOutput } from "../../../lib/ai";
import type { ResolvedWebsiteMedia } from "@/app/lib/business-site-visuals";
import WebsiteMediaVisual from "../WebsiteMediaVisual";

type DarkTemplateProps = {
  companyName: string;
  industry: string;
  websiteGoal: string;
  brandResult?: WebsiteAiOutput & { heroHeadline?: string };
  media: ResolvedWebsiteMedia;
  labels: {
    home: string;
    services: string;
    about: string;
    contact: string;
    howWeCanHelp: string;
  };
};

export default function DarkTemplate({
  companyName,
  industry,
  websiteGoal,
  brandResult,
  labels,
  media,
}: DarkTemplateProps) {
  const businessName = companyName || industry || "—";

  const headline =
    brandResult?.heroHeadline ||
    brandResult?.websiteGoal ||
    businessName;

  const description =
    brandResult?.websiteOverview ||
    brandResult?.designRecommendations ||
    headline;

  return (
    <div className="overflow-hidden rounded-[28px] bg-[#020617] text-white">
      <nav className="flex items-center justify-between border-b border-white/10 px-8 py-5 lg:px-12">
        <div className="text-xl font-bold tracking-tight">{businessName}</div>

        <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <span>{labels.home}</span>
          <span>{labels.services}</span>
          <span>{labels.about}</span>
          <span>{labels.contact}</span>
        </div>
<AnimatedButton>
        <button className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400 hover:text-slate-950">
          {websiteGoal || labels.contact}
        </button>
        </AnimatedButton>
      </nav>

      <section className="relative overflow-hidden px-8 py-20 lg:px-12 lg:py-28">
        <div className="absolute left-0 top-0 h-[460px] w-[460px] rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-0 top-24 h-[520px] w-[520px] rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
              {labels.howWeCanHelp}
            </span>

            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              {headline}
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
              {description.slice(0, 240)}
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <AnimatedButton>
              <button className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-7 py-3.5 font-semibold text-white transition hover:-translate-y-1">
                {websiteGoal || labels.contact}
              </button>
              </AnimatedButton>
<AnimatedButton>
              <button className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">
                {labels.services}
              </button>
              </AnimatedButton>
            </div>

            <div className="mt-12 flex flex-wrap gap-10">
              {[
                ["99.99%", labels.howWeCanHelp],
                ["120+", labels.about],
                ["24/7", labels.contact],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[620px]">
            {media.hero && <WebsiteMediaVisual media={media.hero} className="absolute inset-0 z-40 h-full rounded-[40px] shadow-2xl" />}
            <div className="absolute inset-0 rounded-[40px] border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.03] to-transparent backdrop-blur-xl" />

            <div className="absolute inset-8 rounded-[32px] border border-cyan-400/20 bg-slate-950/80 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-sm text-slate-500">{labels.about}</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {businessName}
                  </p>
                </div>

                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {labels.howWeCanHelp}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  [labels.services, "86%"],
                  [labels.about, "94%"],
                  [labels.howWeCanHelp, "+41%"],
                  [labels.contact, "A+"],
                ].map(([label, value]) => (
                  <AnimatedCard key={label}>
  <div
    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
  >
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
  </div>
</AnimatedCard>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{labels.howWeCanHelp}</p>
                  <span className="text-sm font-semibold text-cyan-300">
                    +32.8%
                  </span>
                </div>

                <div className="mt-6 flex h-36 items-end gap-3">
                  {[42, 58, 51, 70, 64, 86, 78, 100].map((height, index) => (
                    <div
                      key={`${height}-${index}`}
                      className="flex-1 rounded-t-lg bg-gradient-to-t from-blue-600 via-cyan-400 to-violet-400"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -left-8 bottom-16 w-60 rounded-[24px] border border-cyan-400/20 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {labels.about}
              </p>
              <p className="mt-3 text-3xl font-semibold text-cyan-300">+28%</p>
              <p className="mt-2 text-sm text-slate-400">
                {description.slice(0, 80)}
              </p>
            </div>

            <div className="absolute -right-6 top-20 w-56 rounded-[24px] border border-violet-400/20 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {labels.services}
              </p>
              <p className="mt-3 text-3xl font-semibold text-violet-300">
                12.4K
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {description.slice(0, 80)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02] px-8 py-12 lg:px-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          {labels.about}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm font-bold tracking-[0.18em] text-slate-500 sm:grid-cols-3 lg:grid-cols-6">
          {["NEURAL", "ORBIT", "QUANTUM", "VECTOR", "NOVA", "SYNAPSE"].map(
            (name) => (
  <AnimatedCard key={name}>
    <div>{name}</div>
  </AnimatedCard>
)
          )}
        </div>
      </section>

      <section className="px-8 py-24 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            {labels.services}
          </p>

          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            {headline}
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            [labels.services, brandResult?.websiteFeatures || description],
            [labels.about, brandResult?.designRecommendations || description],
            [labels.contact, description],
          ].map(([title, text]) => (
            <AnimatedCard key={title}>
            <div
              className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
            >
              <div className="mb-6 h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500" />
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-4 leading-7 text-slate-400">{text}</p>
            </div>
            </AnimatedCard>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-8 py-24 text-center lg:px-12">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">
          {labels.contact}
        </p>
<AnimatedCard>
        <h2 className="mx-auto mt-5 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-[-0.05em]">
          {headline}
        </h2>
        </AnimatedCard>
<AnimatedButton
  className="mt-10 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 px-8 py-4 font-semibold text-white transition hover:scale-105"
>
  {websiteGoal || labels.contact}
</AnimatedButton>
      </section>
    </div>
  );
}
