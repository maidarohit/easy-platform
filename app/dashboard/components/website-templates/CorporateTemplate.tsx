"use client";

import FadeIn from "../animations/FadeIn";
import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import type { WebsiteAiOutput } from "../../../lib/ai";

type CorporateTemplateProps = {
  companyName: string;
  industry: string;
  websiteGoal: string;
  brandResult?: WebsiteAiOutput & { heroHeadline?: string };
};

export default function CorporateTemplate({
  companyName,
  industry,
  websiteGoal,
  brandResult,
}: CorporateTemplateProps) {
  const businessName = companyName || "Your Business";

  const headline =
    brandResult?.heroHeadline ||
    `Helping ${industry || "businesses"} transform with confidence`;

  const description =
    brandResult?.websiteOverview ||
    "A professional enterprise website designed to build trust, communicate capability, and support long-term business growth.";

  return (
    <div className="overflow-hidden rounded-xl bg-white text-slate-950">
      <nav className="flex items-center justify-between border-b border-slate-200 px-8 py-5 lg:px-12">
        <div className="text-xl font-bold tracking-tight">{businessName}</div>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <span>Solutions</span>
          <span>Industries</span>
          <span>About</span>
          <span>Insights</span>
          <span>Contact</span>
        </div>

        <button className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
          Request Demo
        </button>
      </nav>

      <section className="grid items-center gap-16 px-8 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-28">
        <div>
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Enterprise digital solutions
          </span>
<FadeIn>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.04em] sm:text-6xl">
            {headline}
          </h1>
          </FadeIn>

          <AnimatedButton className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            {description.slice(0, 240)}
          </AnimatedButton>

          <div className="mt-8 flex flex-wrap gap-4">
            <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
              {websiteGoal || "Get Started"}
            </button>

            <AnimatedButton className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-50">
              View Solutions
            </AnimatedButton>
          </div>
        </div>

        <AnimatedCard className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-sm text-slate-500">Enterprise Overview</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                Performance Dashboard
              </p>
            </div>

            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Live
            </span>
          </div>

          <AnimatedCard className="mt-6 grid grid-cols-2 gap-4">
            {[
              ["Revenue", "$18.4M"],
              ["Active Users", "42K"],
              ["Projects", "126"],
              ["Uptime", "99.99%"],
            ].map(([label, value]) => (
              <AnimatedCard
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
              </AnimatedCard>
            ))}
          </AnimatedCard>

          <AnimatedCard className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-950">Business Growth</p>
              <span className="text-sm font-semibold text-emerald-600">
                +28.4%
              </span>
            </div>

            <div className="mt-6 flex h-32 items-end gap-3">
              {[48, 64, 55, 78, 70, 88, 100].map((height, index) => (
                <div
                  key={`${height}-${index}`}
                  className="flex-1 rounded-t-lg bg-blue-600"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </AnimatedCard>
        </AnimatedCard>
      </section>
    </div>
  );
}
