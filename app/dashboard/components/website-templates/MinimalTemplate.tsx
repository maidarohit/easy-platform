"use client";

import AnimatedCard from "../animations/AnimatedCard";
import type { WebsiteAiOutput } from "../../../lib/ai";

type MinimalTemplateProps = {
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

export default function MinimalTemplate({
  companyName,
  industry,
  websiteGoal,
  brandResult,
  labels,
}: MinimalTemplateProps) {
  const businessName = companyName || industry || "—";

  const headline =
    brandResult?.heroHeadline ||
    brandResult?.websiteGoal ||
    businessName;

  const description =
    brandResult?.websiteOverview ||
    brandResult?.designRecommendations ||
    businessName;

  const navLabels = [
  labels.home,
  labels.services,
  labels.about,
  labels.contact,
];

  const featureCards = [
    {
      title: navLabels[0],
      text: brandResult?.websiteFeatures || description,
    },
    {
      title: navLabels[1],
      text: brandResult?.designRecommendations || description,
    },
    {
      title: navLabels[2],
      text: brandResult?.seoRecommendations || description,
    },
  ];

  const processItems = [
    {
      number: "01",
      title: navLabels[0],
      text: brandResult?.websiteOverview || description,
    },
    {
      number: "02",
      title: navLabels[1],
      text: brandResult?.designRecommendations || description,
    },
    {
      number: "03",
      title: navLabels[2],
      text: brandResult?.websiteFeatures || description,
    },
  ];

  return (
    <div className="overflow-hidden rounded-[24px] bg-white text-slate-950">
      <nav className="flex items-center justify-between border-b border-slate-200 px-8 py-6 lg:px-14">
        <div className="text-lg font-semibold tracking-[-0.03em]">
          {businessName}
        </div>

        <div className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
          {navLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <button className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-950 hover:text-white">
          {websiteGoal || navLabels[3]}
        </button>
      </nav>

      <section className="px-8 py-24 lg:px-14 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">
            {businessName}
          </p>

          <h1 className="mt-7 max-w-5xl text-5xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            {headline}
          </h1>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_0.8fr]">
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              {description.slice(0, 260)}
            </p>

            <div className="flex flex-wrap items-start gap-4 lg:justify-end">
              <button className="rounded-full bg-slate-950 px-7 py-3.5 font-medium text-white transition hover:-translate-y-1">
                {websiteGoal || navLabels[3]}
              </button>

              <button className="rounded-full border border-slate-300 px-7 py-3.5 font-medium transition hover:bg-slate-50">
                {navLabels[1]}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-8 py-20 lg:px-14">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {businessName}
              </p>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                {navLabels[0]}
              </span>
            </div>

            <p className="mt-8 text-5xl font-medium tracking-[-0.05em]">
              +31.8%
            </p>

            <p className="mt-3 max-w-sm leading-7 text-slate-500">
              {brandResult?.seoRecommendations || description}
            </p>

            <div className="mt-10 flex h-44 items-end gap-3">
              {[34, 42, 38, 58, 52, 70, 64, 82, 76, 100].map(
                (height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t-full bg-slate-950"
                    style={{ height: `${height}%` }}
                  />
                )
              )}
            </div>
          </div>

          <div className="grid gap-5">
            {featureCards.map((item, index) => (
              <AnimatedCard key={`${item.title}-${index}`}>
                <div className="rounded-[24px] border border-slate-200 bg-white p-7">
                  <h3 className="text-xl font-medium tracking-[-0.03em]">
                    {item.title}
                  </h3>

                  <p className="mt-3 leading-7 text-slate-500">
                    {item.text}
                  </p>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 py-24 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">
                {businessName}
              </p>

              <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.045em]">
                {brandResult?.websiteGoal || headline}
              </h2>
            </div>

            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {processItems.map((item) => (
                <div
                  key={item.number}
                  className="grid gap-5 py-8 sm:grid-cols-[70px_160px_1fr]"
                >
                  <p className="text-sm text-slate-400">
                    {item.number}
                  </p>

                  <h3 className="text-lg font-medium">
                    {item.title}
                  </h3>

                  <p className="leading-7 text-slate-500">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 px-8 py-24 text-center lg:px-14">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">
          {businessName}
        </p>

        <h2 className="mx-auto mt-6 max-w-4xl text-5xl font-medium leading-[1.05] tracking-[-0.05em]">
          {brandResult?.websiteGoal || headline}
        </h2>

        <button className="mt-10 rounded-full bg-slate-950 px-8 py-4 font-medium text-white transition hover:scale-105">
          {websiteGoal || navLabels[3]}
        </button>
      </section>
    </div>
  );
}