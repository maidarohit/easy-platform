import Link from "next/link";

export const metadata = {
  title: "Buzypeezy for Consultants | Build Your Business with AI",
  description:
    "A connected AI business workspace for consultants and professional service firms.",
};

const ArrowIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M5 12H19M13 6L19 12L13 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M5 12.5L9.2 16.5L19 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ConsultantsLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1e8] text-[#102a23]">
      {/* NAVBAR */}
      <nav className="relative z-50 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#103b31] text-sm font-semibold text-white">
            B
          </div>

          <span className="text-lg font-semibold tracking-[-0.03em]">
            Buzypeezy
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-[#40544e] md:flex">
          <a href="#why" className="transition hover:text-[#102a23]">
            Why Buzypeezy
          </a>
          <a href="#workflow" className="transition hover:text-[#102a23]">
            How it works
          </a>
          <a href="#use-cases" className="transition hover:text-[#102a23]">
            For consultants
          </a>
        </div>

        <Link
          href="/signup?source=consultants"
          className="rounded-full bg-[#123d32] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-[#0d3028]"
        >
          Get started
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 5%, rgba(100,148,126,0.20), transparent 34%)",
          }}
        />

        <div className="relative mx-auto max-w-[1440px] px-6 pb-24 pt-20 text-center lg:px-10 lg:pb-32 lg:pt-28">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-[#143d32]/10 bg-white/60 px-4 py-2 text-xs font-medium tracking-wide text-[#34554b] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2e765f]" />
            BUILT FOR CONSULTANTS & PROFESSIONAL SERVICES
          </div>

          <h1 className="mx-auto max-w-5xl text-[48px] font-medium leading-[0.98] tracking-[-0.06em] sm:text-[64px] lg:text-[88px]">
            Your expertise deserves
            <span className="block font-serif italic text-[#39715e]">
              a stronger digital presence.
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-[#53645f] sm:text-lg">
            Buzypeezy gives consultants one connected AI workspace to shape
            their brand, website, content, marketing and growth around the same
            business.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?source=consultants"
              className="group flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#123d32] px-7 py-4 text-sm font-medium text-white shadow-[0_14px_35px_rgba(18,61,50,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(18,61,50,0.26)]"
            >
              Create your business
              <span className="transition-transform group-hover:translate-x-1">
                <ArrowIcon />
              </span>
            </Link>

            <a
              href="#workflow"
              className="flex min-w-[190px] items-center justify-center rounded-full border border-[#123d32]/15 bg-white/55 px-7 py-4 text-sm font-medium backdrop-blur-md transition hover:bg-white"
            >
              See how it works
            </a>
          </div>

          {/* PRODUCT VISUAL */}
          <div className="relative mx-auto mt-20 max-w-6xl">
            <div className="absolute -left-20 top-20 h-52 w-52 rounded-full bg-[#b9d0bf]/30 blur-3xl" />
            <div className="absolute -right-20 bottom-10 h-52 w-52 rounded-full bg-[#ccb98f]/25 blur-3xl" />

            <div className="relative rounded-[32px] border border-white/70 bg-white/60 p-3 shadow-[0_40px_120px_rgba(31,57,48,0.14)] backdrop-blur-xl sm:p-5">
              <div className="overflow-hidden rounded-[24px] border border-[#153b31]/10 bg-[#f8f8f4] text-left">
                <div className="flex items-center justify-between border-b border-[#153b31]/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-[#183f34]" />
                    <span className="text-sm font-medium">Buzypeezy Workspace</span>
                  </div>

                  <div className="rounded-full bg-[#e7eee9] px-3 py-1 text-[11px] text-[#446159]">
                    Business connected
                  </div>
                </div>

                <div className="grid min-h-[520px] lg:grid-cols-[220px_1fr]">
                  <aside className="hidden border-r border-[#153b31]/10 bg-[#f1f2ec] p-5 lg:block">
                    <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#84928d]">
                      Workspace
                    </p>

                    {[
                      "AI Manager",
                      "Branding AI",
                      "Website AI",
                      "Marketing AI",
                      "SEO AI",
                      "Sales AI",
                      "Analytics AI",
                    ].map((item, index) => (
                      <div
                        key={item}
                        className={`mb-1 rounded-xl px-3 py-3 text-sm ${
                          index === 0
                            ? "bg-[#153f34] text-white"
                            : "text-[#556761]"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </aside>

                  <div className="p-5 sm:p-8">
                    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-[#84928d]">
                          Consultant workspace
                        </p>
                        <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
                          Your business, connected.
                        </h2>
                      </div>

                      <button className="rounded-full bg-[#153f34] px-5 py-3 text-xs font-medium text-white">
                        Continue business
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        {
                          title: "Brand Direction",
                          text: "Keep your positioning, tone and identity aligned.",
                        },
                        {
                          title: "Website",
                          text: "Turn your expertise into a clearer digital presence.",
                        },
                        {
                          title: "Growth",
                          text: "Plan marketing, SEO and client acquisition together.",
                        },
                      ].map((card) => (
                        <div
                          key={card.title}
                          className="rounded-[22px] border border-[#143d32]/10 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                        >
                          <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7efe9] text-[#174839]">
                            <CheckIcon />
                          </div>

                          <h3 className="text-base font-medium">{card.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#6d7c77]">
                            {card.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_.6fr]">
                      <div className="rounded-[22px] bg-[#163c32] p-7 text-white">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/55">
                          AI Manager
                        </p>

                        <h3 className="mt-5 max-w-md text-2xl font-medium tracking-[-0.04em]">
                          One business context across every AI module.
                        </h3>

                        <div className="mt-10 flex flex-wrap gap-2">
                          {["Brand", "Website", "Marketing", "SEO", "Sales"].map(
                            (item) => (
                              <span
                                key={item}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70"
                              >
                                {item}
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-[#143d32]/10 bg-[#ece8dc] p-7">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#74847e]">
                          Next step
                        </p>

                        <p className="mt-5 text-lg font-medium">
                          Move from planning to execution.
                        </p>

                        <div className="mt-10 h-1.5 overflow-hidden rounded-full bg-[#d7d4ca]">
                          <div className="h-full w-[72%] rounded-full bg-[#286650]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POSITIONING */}
      <section
        id="why"
        className="border-y border-[#173c32]/10 bg-[#ede9df]"
      >
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-24 lg:grid-cols-2 lg:px-10 lg:py-32">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#668077]">
              Your expertise is the product
            </p>

            <h2 className="mt-6 max-w-xl text-4xl font-medium leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Stop letting a scattered digital presence{" "}
              <span className="font-serif italic text-[#39715e]">
                weaken the first impression.
              </span>
            </h2>
          </div>

          <div className="flex flex-col justify-end">
            <p className="max-w-xl text-lg leading-8 text-[#5a6a65]">
              Consultants often build authority through experience, but their
              website, messaging, content and marketing live across disconnected
              tools. Buzypeezy keeps the business context connected from the
              beginning.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                "Stronger business positioning",
                "Clearer service presentation",
                "Consistent brand communication",
                "Connected marketing execution",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-white/65 px-4 py-4 text-sm"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dce9e1] text-[#255b48]">
                    <CheckIcon />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="bg-[#12372e] text-white">
        <div className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#91b4a6]">
                One connected workflow
              </p>

              <h2 className="mt-6 max-w-3xl text-4xl font-medium leading-[1] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Start with your business.
                <span className="block font-serif italic text-[#a7c5b7]">
                  Let everything else follow.
                </span>
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-white/60">
              Instead of rebuilding the same context inside different tools,
              Buzypeezy organizes your work around one project.
            </p>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[30px] bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Define",
                text: "Tell Buzypeezy about your consulting business and audience.",
              },
              {
                n: "02",
                title: "Shape",
                text: "Build your positioning, brand direction and online presence.",
              },
              {
                n: "03",
                title: "Execute",
                text: "Create website, content, marketing and SEO work from the same context.",
              },
              {
                n: "04",
                title: "Grow",
                text: "Use connected sales and analytics workflows to guide the next move.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="min-h-[300px] bg-[#12372e] p-8 transition hover:bg-[#173f35]"
              >
                <p className="text-xs text-white/35">{step.n}</p>
                <div className="mt-24">
                  <h3 className="text-2xl font-medium">{step.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/55">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
{/* REAL PRODUCT SHOWCASE */}
<section className="overflow-hidden bg-[#f3efe5] px-5 py-20 md:px-10 md:py-36">
  <div className="mx-auto max-w-[1440px]">

    {/* Heading */}
    <div className="mx-auto mb-20 max-w-4xl text-center">
      <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#4f7f70]">
        See the workspace in action
      </p>

      <h2 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-[#103d34] md:text-6xl lg:text-7xl">
        One business. Multiple outputs.
        <span className="mt-2 block font-serif italic font-normal text-[#4f7f70]">
          All connected to the same context.
        </span>
      </h2>

      <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-[#58665f] md:text-lg">
        Your website, marketing, SEO and sales work from the same business
        foundation instead of starting from zero across separate tools.
      </p>
    </div>

    {/* Main dashboard */}
    <div className="relative mx-auto max-w-6xl">
      <div className="overflow-hidden rounded-[28px] border border-[#d7ddd7] bg-white p-2 shadow-[0_35px_100px_rgba(16,61,52,0.14)] md:p-3">
        <div className="mb-2 flex items-center gap-2 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d8ddd8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d8ddd8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d8ddd8]" />

          <span className="ml-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#78867f]">
            Buzypeezy workspace
          </span>
        </div>

        <img
          src="/consultants/dashboard.jpeg"
          alt="Buzypeezy business dashboard"
          className="block w-full rounded-[20px]"
        />
      </div>

      {/* Floating label */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-[#d8ded8] bg-[#fbfaf6] px-5 py-3 shadow-lg">
        <span className="text-xs font-medium text-[#103d34]">
          One connected business workspace
        </span>
      </div>
    </div>

    {/* Product modules */}
    <div className="mt-16 grid gap-6 md:mt-28 md:grid-cols-2">

      {/* Website AI */}
      <div className="group overflow-hidden rounded-[28px] border border-[#d8ded8] bg-[#faf9f5] p-3 shadow-[0_20px_60px_rgba(16,61,52,0.08)]">
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.23em] text-[#708079]">
              Web intelligence
            </p>
            <p className="mt-1 text-lg font-medium text-[#103d34]">
              Website AI
            </p>
          </div>

          <span className="rounded-full bg-[#e8efe9] px-3 py-1 text-[10px] font-medium text-[#245d50]">
            BUILD
          </span>
        </div>

        <div className="overflow-hidden rounded-[20px]">
          <img
            src="/consultants/website-ai.jpeg"
            alt="Buzypeezy Website AI"
            className="w-full transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Marketing AI */}
      <div className="group overflow-hidden rounded-[28px] border border-[#d8ded8] bg-[#faf9f5] p-3 shadow-[0_20px_60px_rgba(16,61,52,0.08)] md:translate-y-12">
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.23em] text-[#708079]">
              Growth intelligence
            </p>
            <p className="mt-1 text-lg font-medium text-[#103d34]">
              Marketing AI
            </p>
          </div>

          <span className="rounded-full bg-[#e8efe9] px-3 py-1 text-[10px] font-medium text-[#245d50]">
            GROW
          </span>
        </div>

        <div className="overflow-hidden rounded-[20px]">
          <img
            src="/consultants/marketing-ai.png"
            alt="Buzypeezy Marketing AI"
            className="w-full transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* SEO AI */}
      <div className="group overflow-hidden rounded-[28px] border border-[#d8ded8] bg-[#faf9f5] p-3 shadow-[0_20px_60px_rgba(16,61,52,0.08)]">
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.23em] text-[#708079]">
              Search intelligence
            </p>
            <p className="mt-1 text-lg font-medium text-[#103d34]">
              SEO AI
            </p>
          </div>

          <span className="rounded-full bg-[#e8efe9] px-3 py-1 text-[10px] font-medium text-[#245d50]">
            DISCOVER
          </span>
        </div>

        <div className="overflow-hidden rounded-[20px]">
          <img
            src="/consultants/seo-ai.jpeg"
            alt="Buzypeezy SEO AI"
            className="w-full transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Sales AI */}
      <div className="group overflow-hidden rounded-[28px] border border-[#d8ded8] bg-[#faf9f5] p-3 shadow-[0_20px_60px_rgba(16,61,52,0.08)] md:translate-y-12">
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.23em] text-[#708079]">
              Revenue intelligence
            </p>
            <p className="mt-1 text-lg font-medium text-[#103d34]">
              Sales AI
            </p>
          </div>

          <span className="rounded-full bg-[#e8efe9] px-3 py-1 text-[10px] font-medium text-[#245d50]">
            CONVERT
          </span>
        </div>

        <div className="overflow-hidden rounded-[20px]">
          <img
            src="/consultants/sales-ai.jpeg"
            alt="Buzypeezy Sales AI"
            className="w-full transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </div>

    </div>
  </div>
</section>
      {/* USE CASES */}
      <section id="use-cases" className="bg-[#f4f1e8]">
        <div className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#668077]">
              Designed around professional expertise
            </p>

            <h2 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Built for businesses where
              <span className="font-serif italic text-[#39715e]">
                {" "}
                trust comes first.
              </span>
            </h2>
          </div>

          <div className="mt-16 grid gap-4 lg:grid-cols-2">
            {[
              [
                "Independent Consultants",
                "Turn individual expertise into a more structured and credible digital business.",
              ],
              [
                "Advisory Firms",
                "Keep positioning, website and marketing aligned across a professional service offering.",
              ],
              [
                "Business Consultants",
                "Present complex services clearly while creating consistent content and growth campaigns.",
              ],
              [
                "Professional Services",
                "Build a connected digital presence without stitching together a long list of separate tools.",
              ],
            ].map(([title, text], index) => (
              <div
                key={title}
                className={`group rounded-[30px] border border-[#143d32]/10 p-8 transition duration-300 hover:-translate-y-1 lg:p-10 ${
                  index === 0
                    ? "bg-[#e4ebe4]"
                    : index === 3
                    ? "bg-[#e8dfcd]"
                    : "bg-white/55"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs text-[#72847e]">
                    0{index + 1}
                  </span>

                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#143d32]/15 transition group-hover:bg-[#153f34] group-hover:text-white">
                    <ArrowIcon />
                  </span>
                </div>

                <div className="mt-20">
                  <h3 className="text-2xl font-medium tracking-[-0.04em]">
                    {title}
                  </h3>

                  <p className="mt-4 max-w-lg text-sm leading-7 text-[#63736e]">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEFORE AFTER */}
      <section className="bg-[#e9e5da]">
        <div className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
          <div className="grid overflow-hidden rounded-[34px] border border-[#143d32]/10 lg:grid-cols-2">
            <div className="bg-[#dedbd2] p-8 sm:p-12 lg:p-16">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#82908b]">
                Without a connected system
              </p>

              <h3 className="mt-7 text-3xl font-medium tracking-[-0.05em]">
                Too many disconnected decisions.
              </h3>

              <div className="mt-12 space-y-3">
                {[
                  "Website handled separately",
                  "Branding disconnected from marketing",
                  "Content created without shared context",
                  "SEO treated as another standalone task",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-black/5 bg-white/45 px-5 py-4 text-sm text-[#64716d]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#153d33] p-8 text-white sm:p-12 lg:p-16">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9cbcaf]">
                With Buzypeezy
              </p>

              <h3 className="mt-7 text-3xl font-medium tracking-[-0.05em]">
                One business context from strategy to execution.
              </h3>

              <div className="mt-12 space-y-3">
                {[
                  "Connected business workspace",
                  "Consistent brand direction",
                  "Website, content and marketing aligned",
                  "Growth work organized around the same project",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/75"
                  >
                    <span className="text-[#a8cabb]">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#0d2d26] text-white">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 100%, rgba(91,145,118,0.35), transparent 42%)",
          }}
        />

        <div className="relative mx-auto max-w-[1440px] px-6 py-28 text-center lg:px-10 lg:py-40">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9bb9ae]">
            BUILT AROUND YOUR BUSINESS
          </p>

          <h2 className="mx-auto mt-7 max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Give your expertise
            <span className="block font-serif italic text-[#abc8bc]">
              the presence it deserves.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-white/55">
            Start your Buzypeezy workspace and turn your business direction
            into connected execution.
          </p>

          <Link
            href="/signup?source=consultants"
            className="group mx-auto mt-10 inline-flex items-center gap-2 rounded-full bg-[#edf3ec] px-7 py-4 text-sm font-medium text-[#12372e] transition duration-300 hover:-translate-y-1"
          >
            Start with your business
            <span className="transition group-hover:translate-x-1">
              <ArrowIcon />
            </span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0d2d26] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 border-t border-white/10 px-6 py-8 text-xs text-white/45 sm:flex-row lg:px-10">
          <span>© 2026 Buzypeezy</span>
          <span>AI-powered business execution workspace</span>
        </div>
      </footer>
    </main>
  );
}