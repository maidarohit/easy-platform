"use client";

import FadeIn from "../animations/FadeIn";
import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import RealEstateTemplate from "./RealEstateTemplate";
import type { WebsiteAiOutput } from "../../../lib/ai";

type LuxuryTemplateProps = {
  companyName: string;
  industry: string;
  websiteGoal: string;
  websiteRequirements?: string;
  previewMode?: "desktop" | "tablet" | "mobile";
  brandResult?: WebsiteAiOutput & { heroHeadline?: string };
};

export default function LuxuryTemplate({
  companyName,
  industry,
  websiteGoal,
  websiteRequirements,
  previewMode = "desktop",
  brandResult,
}: LuxuryTemplateProps) {
  if (/real\s*estate|realty|property|properties/i.test(industry)) {
    return (
      <RealEstateTemplate
        companyName={companyName}
        websiteGoal={websiteGoal}
        websiteStyle="Luxury"
        websiteRequirements={websiteRequirements}
        previewMode={previewMode}
        brandResult={brandResult}
      />
    );
  }

  const businessName = companyName || "Your Business";

  const headline =
    brandResult?.heroHeadline ||
    `Elevate your ${industry || "business"} with a refined digital presence`;

  const description =
    brandResult?.websiteOverview ||
    "A sophisticated digital experience designed to build trust, attract premium clients, and position your business with authority.";

  return (
    <div className="overflow-hidden rounded-[8px] bg-[#0b0a09] text-[#f8f3e8]">
      <nav className="flex items-center justify-between border-b border-[#2d2924] px-8 py-6 lg:px-14">
        <div className="font-serif text-2xl tracking-[0.08em]">
          {businessName}
        </div>

        <div className="hidden items-center gap-10 text-xs uppercase tracking-[0.22em] text-[#c8bea9] md:flex">
          <span>Home</span>
          <span>About</span>
          <span>Services</span>
          <span>Journal</span>
          <span>Contact</span>
        </div>

        <button className="border border-[#d4af37] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37] transition hover:bg-[#d4af37] hover:text-black">
          Enquire
        </button>
      </nav>

      <section className="relative overflow-hidden px-8 py-24 lg:px-14 lg:py-32">
        <div className="absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[420px] w-[420px] rounded-full bg-[#7c5c2e]/10 blur-3xl" />

        <div className="relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#d4af37]">
              Curated digital excellence
            </p>
<FadeIn>
            <h1 className="mt-7 max-w-3xl font-serif text-5xl leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
              {headline}
            </h1>
            </FadeIn>
<FadeIn delay={0.3}>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#c8bea9]">
              {description.slice(0, 240)}
            </p>
            </FadeIn>

            <div className="mt-10 flex flex-wrap gap-4">
                <AnimatedButton>
  <span className="inline-flex bg-[#d4af37] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-black">
    SELL PRODUCTS
  </span>
</AnimatedButton>
<AnimatedButton>
  <span className="inline-flex border border-[#5b5247] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em]">
    Discover More
  </span>
</AnimatedButton>
            </div>

            <div className="mt-14 grid max-w-xl grid-cols-3 gap-8 border-t border-[#2d2924] pt-8">
                <AnimatedCard>
              <div>
                <p className="font-serif text-3xl text-[#d4af37]">18+</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#9e9485]">
                  Years of excellence
                </p>
              </div>
              </AnimatedCard>
<AnimatedCard>
              <div>
                <p className="font-serif text-3xl text-[#d4af37]">240</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#9e9485]">
                  Select clients
                </p>
              </div>
              </AnimatedCard>
<AnimatedCard>
              <div>
                <p className="font-serif text-3xl text-[#d4af37]">32</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#9e9485]">
                  Global markets
                </p>
              </div>
              </AnimatedCard>
            </div>
          </div>

          <div className="relative min-h-[620px]">
            <div className="absolute inset-0 border border-[#3a342d] bg-gradient-to-br from-[#171411] via-[#0f0d0b] to-[#241b11]" />
<AnimatedCard>
            <div className="absolute inset-8 border border-[#5b5247] bg-[#14110f] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[#2d2924] pb-5">
                <p className="text-xs uppercase tracking-[0.25em] text-[#9e9485]">
                  Private overview
                </p>
                <span className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">
                  Live
                </span>
              </div>

              <div className="mt-10">
                <p className="text-sm text-[#9e9485]">Portfolio performance</p>
                <p className="mt-3 font-serif text-5xl text-[#f8f3e8]">+38.4%</p>

                <div className="mt-10 grid grid-cols-7 items-end gap-3">
                  {[42, 58, 47, 72, 66, 86, 100].map((height, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-t from-[#7a5d2a] to-[#d4af37]"
                      style={{ height: `${height * 2.1}px` }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="border border-[#2d2924] bg-[#0d0b09] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7f7669]">
                    Conversion
                  </p>
                  <p className="mt-3 font-serif text-3xl">9.8%</p>
                </div>

                <div className="border border-[#2d2924] bg-[#0d0b09] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7f7669]">
                    Client value
                  </p>
                  <p className="mt-3 font-serif text-3xl">$1.2M</p>
                </div>
              </div>
            </div>
</AnimatedCard>
            <div className="absolute -left-8 bottom-10 w-64 border border-[#5b5247] bg-[#f3ead8] p-6 text-black shadow-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7a6e5e]">
                Featured service
              </p>
              <p className="mt-3 font-serif text-2xl">
                Bespoke growth strategy
              </p>
              <p className="mt-4 text-sm leading-6 text-[#5c554d]">
                Tailored positioning, design and execution for premium brands.
              </p>
            </div>

            <div className="absolute -right-6 top-14 w-52 border border-[#5b5247] bg-[#1b1713]/95 p-5 shadow-2xl backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9e9485]">
                Client confidence
              </p>
              <p className="mt-3 font-serif text-4xl text-[#d4af37]">98%</p>
              <div className="mt-5 h-px bg-[#3a342d]">
                <div className="h-px w-[98%] bg-[#d4af37]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#2d2924] bg-[#0f0d0b] px-8 py-12 lg:px-14">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-[#7f7669]">
          Trusted by distinguished brands
        </p>

        <div className="mt-9 grid grid-cols-2 gap-8 text-center font-serif text-lg tracking-[0.16em] text-[#8f8577] sm:grid-cols-3 lg:grid-cols-6">
          {["AURELIA", "MONARCH", "VELORA", "SOVEREIGN", "NOIR", "ATELIER"].map(
            (name) => (
              <div key={name}>{name}</div>
            )
          )}
        </div>
      </section>

      <section className="px-8 py-24 lg:px-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.32em] text-[#d4af37]">
            Our approach
          </p>

          <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">
            Refined strategy. Impeccable execution.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl leading-8 text-[#a99f90]">
            Every detail is considered to create a digital presence that feels
            distinctive, credible and timeless.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            ["01", "Positioning", "Clarify your value and sharpen your market presence."],
            ["02", "Experience", "Create a visual system that feels premium and effortless."],
            ["03", "Growth", "Turn attention into meaningful business outcomes."],
          ].map(([number, title, text]) => (
            <div
              key={number}
              className="border border-[#2d2924] bg-[#11100e] p-8 transition hover:border-[#d4af37]"
            >
              <p className="font-serif text-2xl text-[#d4af37]">{number}</p>
              <h3 className="mt-8 font-serif text-2xl">{title}</h3>
              <p className="mt-4 leading-7 text-[#9e9485]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#2d2924] px-8 py-24 text-center lg:px-14">
        <p className="text-xs uppercase tracking-[0.3em] text-[#d4af37]">
          Begin your next chapter
        </p>

        <h2 className="mx-auto mt-5 max-w-3xl font-serif text-5xl leading-tight">
          Let’s build a digital presence worthy of {businessName}.
        </h2>

        <button className="mt-10 bg-[#d4af37] px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-black">
          Start a Conversation
        </button>
      </section>
    </div>
  );
}
