"use client";

import FadeIn from "../animations/FadeIn";
import SlideUp from "../animations/SlideUp";
import ScaleIn from "../animations/ScaleIn";
import Floating from "../animations/Floating";
import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import type { WebsiteAiOutput } from "../../../lib/ai";

type CreativeTemplateProps = {
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
};

export default function CreativeTemplate({
  companyName,
  industry,
  websiteGoal,
  brandResult,
  labels,
}: CreativeTemplateProps) {
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
    <div className="overflow-hidden rounded-[32px] bg-[#fff8f2] text-slate-950">
      <nav className="flex items-center justify-between px-8 py-6 lg:px-12">
        <div className="text-2xl font-black tracking-[-0.04em]">
          {businessName}
        </div>

        <div className="hidden items-center gap-8 text-sm font-semibold md:flex">
          <span>{labels.home}</span>
          <span>{labels.about}</span>
          <span>{labels.services}</span>
          <span>{labels.howWeCanHelp}</span>
          <span>{labels.contact}</span>
        </div>

        <button className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-1">
          {labels.contact}
        </button>
      </nav>

      <section className="relative overflow-hidden px-8 pb-24 pt-16 lg:px-12 lg:pb-32 lg:pt-20">
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-fuchsia-300/50 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-300/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-orange-300/40 blur-3xl" />

        <div className="relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex rotate-[-2deg] rounded-full border-2 border-slate-950 bg-yellow-300 px-4 py-2 text-sm font-black shadow-[4px_4px_0_#0f172a]">
              {labels.about}
            </span>
<FadeIn>
            <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
              {headline}
            </h1>
            </FadeIn>
<FadeIn delay={0.2}>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-700">
              {description.slice(0, 240)}
            </p>
            </FadeIn>

            <div className="mt-9 flex flex-wrap gap-4">
                 <AnimatedButton>
              <button className="rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-7 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-1">
                {websiteGoal || labels.contact}
              </button>
              </AnimatedButton>
 <AnimatedButton>
              <button className="rounded-full border-2 border-slate-950 bg-white px-7 py-3.5 font-bold shadow-[4px_4px_0_#0f172a] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
                {labels.services}
              </button>
              </AnimatedButton>
            </div>

            <div className="mt-12 flex flex-wrap gap-8">
              {[
                ["48", labels.about],
                ["160+", labels.services],
                ["19", labels.contact],
              ].map(([value, label]) => (
                <AnimatedCard key={label}>
                  <p className="text-3xl font-black">{value}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {label}
                  </p>
                </AnimatedCard>
              ))}
            </div>
          </div>
<AnimatedCard>
          <div className="relative min-h-[620px]">
            <div className="absolute left-10 top-12 h-80 w-72 rotate-[-8deg] rounded-[36px] bg-fuchsia-500 shadow-2xl" />
            <div className="absolute right-8 top-20 h-80 w-72 rotate-[8deg] rounded-[36px] bg-cyan-400 shadow-2xl" />
            <div className="absolute left-1/2 top-1/2 z-20 w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-[38px] border-4 border-slate-950 bg-white p-6 shadow-[10px_12px_0_#0f172a]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{labels.howWeCanHelp}</p>
                <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black">
                  {businessName}
                </span>
              </div>

              <p className="mt-5 text-5xl font-black">+74%</p>
              <p className="mt-2 text-sm text-slate-500">
                {description.slice(0, 80)}
              </p>

              <div className="mt-8 flex h-40 items-end gap-3">
                {[42, 68, 56, 82, 74, 96, 88].map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t-xl bg-gradient-to-t from-fuchsia-500 to-cyan-400"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute bottom-20 left-0 z-30 w-56 rotate-[-7deg] rounded-3xl border-4 border-slate-950 bg-yellow-300 p-5 shadow-[7px_7px_0_#0f172a]">
              <p className="text-sm font-black">{labels.about}</p>
              <p className="mt-2 text-4xl font-black">98%</p>
            </div>

            <div className="absolute bottom-12 right-0 z-30 w-56 rotate-[6deg] rounded-3xl border-4 border-slate-950 bg-white p-5 shadow-[7px_7px_0_#0f172a]">
              <p className="text-sm font-black">{labels.services}</p>
              <p className="mt-2 text-4xl font-black">2.4M</p>
            </div>
          </div>
        </AnimatedCard>
        </div>
      </section>

      <section className="bg-slate-950 px-8 py-20 text-white lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            {labels.services}
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            {brandResult?.websiteFeatures || headline}
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            [labels.about, brandResult?.designRecommendations || description],
            [labels.services, brandResult?.websiteFeatures || description],
            [labels.contact, description],
          ].map(([title, text], index) => (
            <AnimatedCard
              key={title}
              className={`rounded-[28px] border border-white/10 p-7 ${
                index === 0
                  ? "bg-fuchsia-500"
                  : index === 1
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-yellow-300 text-slate-950"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                0{index + 1}
              </p>
              <h3 className="mt-10 text-2xl font-black">{title}</h3>
              <p className="mt-4 leading-7 opacity-80">{text}</p>
            </AnimatedCard>
          ))}
        </div>
      </section>

      <section className="px-8 py-24 text-center lg:px-12">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-fuchsia-500">
          {labels.contact}
        </p>

        <h2 className="mx-auto mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.05em]">
          {headline}
        </h2>

        <button className="mt-10 rounded-full bg-slate-950 px-8 py-4 font-bold text-white transition hover:scale-105">
          {websiteGoal || labels.contact}
        </button>
      </section>
    </div>
  );
}
