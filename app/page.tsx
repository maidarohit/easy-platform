import Link from "next/link";
import { BILLING_PLANS } from "@/app/lib/billing-plans";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { TranslatedText } from "./components/TranslatedText";
const ArrowIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-4 w-4"
  >
    <path d="M4 10h12m-4-4 4 4-4 4" />
  </svg>
);

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-4 w-4"
  >
    <path d="m4 10 4 4 8-8" />
  </svg>
);

const outcomeIcons = [
  <svg
    key="direction"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-6 w-6"
  >
    <circle cx="12" cy="12" r="8" />
    <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4z" />
  </svg>,
  <svg
    key="presence"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-6 w-6"
  >
    <path d="M4 5h16v14H4zM4 9h16" />
    <path d="M8 14h3m2 0h3" />
  </svg>,
  <svg
    key="reach"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-6 w-6"
  >
    <circle cx="8" cy="12" r="3" />
    <circle cx="17" cy="7" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="m10.5 10.5 4.7-2.4m-4.7 5.4 4.7 2.4" />
  </svg>,
  <svg
    key="growth"
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="h-6 w-6"
  >
    <path d="M4 18 10 12l4 3 6-8" />
    <path d="M15 7h5v5" />
  </svg>,
];
export default function Home() {
const outcomes = [
  ["startStrong", "startStrongDescription"],
  ["lookProfessional", "lookProfessionalDescription"],
  ["reachMore", "reachMoreDescription"],
  ["keepGrowing", "keepGrowingDescription"],
] as const;
  const steps = [
    ["stepTellTitle", "stepTellDescription"],
    ["stepUnderstandTitle", "stepUnderstandDescription"],
    ["stepCreateTitle", "stepCreateDescription"],
    ["stepReviewTitle", "stepReviewDescription"],
  ] as const;
  const overview = [
    "overviewDirection", "overviewPresence", "overviewGrowth",
    "overviewContent", "overviewPerformance", "overviewActions",
  ] as const;
  const benefits = [
    "benefitSecure", "benefitOrganised", "benefitControl", "benefitGrowth",
  ] as const;
  const planFeatureKeys = {
    pro: ["proFeatureConnected", "proFeatureAi", "proFeatureSaved"],
    business: ["businessFeatureStarter", "businessFeatureCapacity", "businessFeatureSupport"],
  } as const;
  const plans = [
    BILLING_PLANS.pro,
    { ...BILLING_PLANS.business, featured: true },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F4EC] text-[#1B211E] selection:bg-[#A8B8A7]/50">
      <nav
        className="sticky top-0 z-50 border-b border-[#173D32]/10 bg-[#F7F4EC]/90 backdrop-blur-xl"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-[-0.03em] text-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]"
          >
            Buzypeezy
          </Link>
          <div className="hidden items-center gap-8 [font-size:clamp(0.9375rem,1.1vw,1.0625rem)] font-medium text-[#52605A] md:flex">
            <a href="#how-it-works" className="transition hover:text-[#173D32]">
              <TranslatedText id="howItWorks" />
            </a>
            <a href="#for-business" className="transition hover:text-[#173D32]">
              <TranslatedText id="forBusiness" />
            </a>
            <a href="#pricing" className="transition hover:text-[#173D32]">
              <TranslatedText id="pricing" />
            </a>
            <a href="#about" className="transition hover:text-[#173D32]">
              <TranslatedText id="about" />
            </a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-lg px-2 py-2 text-[15px] font-semibold text-[#173D32] transition hover:bg-[#EEE9DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] sm:px-3"
            >
              <TranslatedText id="login" />
            </Link>
            <Link
              href="/idea-finder"
              className="rounded-lg px-3 py-2 text-[15px] font-semibold text-[#173D32] transition hover:bg-[#173D32]/5"
            >
              <TranslatedText id="findIdea" />
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[#173D32] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(23,61,50,0.16)] transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61] sm:px-5"
            >
              <TranslatedText id="startBuilding" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative border-b border-[#173D32]/10 py-24 sm:py-32 lg:py-40">
        <div className="pointer-events-none absolute -left-44 top-10 h-96 w-96 rounded-full bg-[#A8B8A7]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#DCCBAA]/25 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8">
          <div className="mx-auto flex max-w-4xl flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
              <TranslatedText id="tagline" />
            </p>
            <h1 className="mt-7 max-w-4xl [font-size:clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-[#1B211E]">
              <TranslatedText id="hero1" />
              <br />
              <span className="text-[#173D32]">
  <TranslatedText id="hero2" />
</span>
            </h1>
            <p className="mt-8 max-w-2xl [font-size:clamp(1.0625rem,1.7vw,1.375rem)] leading-[1.65] text-[#626A64]">
  <TranslatedText id="description" />
</p>
            <div className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173D32] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(23,61,50,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]"
              >
                <TranslatedText id="startBuilding" /> <ArrowIcon />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-[#173D32]/20 bg-[#FCFBF7]/70 px-6 py-3.5 text-sm font-semibold text-[#173D32] transition hover:-translate-y-0.5 hover:border-[#173D32]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]"
              >
                <TranslatedText id="seeHow" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="for-business" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
              <TranslatedText id="businessEyebrow" />
            </p>
            <h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">
              <TranslatedText id="businessTitle" />
            </h2>
            <p className="mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">
              <TranslatedText id="businessDescription" />
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {outcomes.map(([title, description], index) => (
              <article
                key={title}
                className="group rounded-[24px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_15px_40px_rgba(40,52,45,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#173D32]/20 hover:shadow-[0_20px_45px_rgba(40,52,45,0.09)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#173D32]/15 bg-[#EDF0E8] text-[#173D32]">
                  {outcomeIcons[index]}
                </div>
                <h3 className="mt-8 [font-size:clamp(1.5rem,2vw,1.75rem)] font-semibold leading-tight text-[#0E2C24]">
                  <TranslatedText id={title} />
                </h3>
                <p className="mt-4 [font-size:clamp(1rem,1.2vw,1.125rem)] leading-[1.7] text-[#6F756F]">
                  <TranslatedText id={description} />
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 bg-[#EEE9DC] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
              <TranslatedText id="howItWorks" />
            </p>
            <h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">
              <TranslatedText id="howTitle" />
            </h2>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-4">
            {steps.map(([title, description], index) => (
              <article
                key={title}
                className="relative rounded-[24px] border border-[#173D32]/10 bg-[#FCFBF7]/85 p-7"
              >
                <p className="text-base font-semibold text-[#B89A61]">
                  0{index + 1}
                </p>
                <h3 className="mt-8 [font-size:clamp(1.375rem,1.8vw,1.625rem)] font-semibold leading-tight text-[#0E2C24]">
                  <TranslatedText id={title} />
                </h3>
                <p className="mt-4 [font-size:clamp(1rem,1.15vw,1.125rem)] leading-[1.7] text-[#6F756F]">
                  <TranslatedText id={description} />
                </p>
                {index < 3 && (
                  <span className="absolute -right-3 top-8 z-10 hidden text-[#A8B8A7] lg:block">
                    →
                  </span>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
            <TranslatedText id="beginNaturally" />
          </p>
          <h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">
            <TranslatedText id="beginTitle" />
          </h2>
          <p className="mx-auto mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">
            <TranslatedText id="beginDescription" />
          </p>
          <div className="relative mt-12 rounded-[30px] border border-[#173D32]/15 bg-[#FCFBF7] p-7 text-left shadow-[0_25px_70px_rgba(40,52,45,0.09)] sm:p-12">
            <div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-[#B89A61] to-transparent" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7C857E]">
              <TranslatedText id="briefLabel" />
            </p>
            <blockquote className="mt-6 [font-size:clamp(1.5rem,3vw,2.25rem)] leading-[1.45] tracking-[-0.025em] text-[#27332E]">
              <TranslatedText id="briefExample" />
            </blockquote>
            <div className="mt-9 flex justify-end">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[#173D32] px-5 py-3 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]"
              >
                <TranslatedText id="continueWithBuzypeezy" /> <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#173D32] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D6C49D]">
              <TranslatedText id="connectedOutcomes" />
            </p>
            <h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em]">
              <TranslatedText id="connectedTitle" />
            </h2>
            <p className="mt-6 [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#C1CBC5]">
              <TranslatedText id="connectedDescription" />
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D6C49D] text-sm font-semibold text-[#173D32]">
                  0{index + 1}
                </span>
                <span className="text-base font-medium"><TranslatedText id={item} /></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
              <TranslatedText id="simplePlans" />
            </p>
            <h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">
              <TranslatedText id="pricingTitle" />
            </h2>
            <p className="mx-auto mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">
              <TranslatedText id="pricingDescription" />
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-[28px] border p-8 transition hover:-translate-y-1 ${plan.featured ? "border-[#173D32] bg-[#EDF0E8] shadow-[0_24px_60px_rgba(23,61,50,0.12)]" : "border-[#173D32]/10 bg-[#FCFBF7]"}`}
              >
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#173D32] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">
                    <TranslatedText id="mostSelected" />
                  </span>
                )}
                <h3 className="text-2xl font-semibold text-[#0E2C24]">
                  <TranslatedText id={plan.key === "pro" ? "planPro" : "planBusiness"} />
                </h3>
                <div className="mt-8 flex items-end gap-1">
                  <span className="[font-size:clamp(3.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.05em] text-[#0E2C24]">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-base text-[#747B76]">
                    <TranslatedText id={plan.key === "pro" ? "periodPro" : "periodBusiness"} />
                  </span>
                </div>
                <p className="mt-6 min-h-14 text-base leading-7 text-[#6F756F]">
                  <TranslatedText id={plan.key === "pro" ? "planProDescription" : "planBusinessDescription"} />
                </p>
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, index) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 text-base text-[#46514B]"
                    >
                      <span className="text-[#173D32]">
                        <CheckIcon />
                      </span>
                      <TranslatedText id={planFeatureKeys[plan.key][index]} />
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/billing?plan=${plan.key}`}
                  className={`mt-9 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61] ${plan.featured ? "bg-[#173D32] text-white hover:bg-[#0E2C24]" : "border border-[#173D32]/20 text-[#173D32] hover:border-[#173D32]/40 hover:bg-[#EDF0E8]"}`}
                >
                  <TranslatedText id={plan.key === "pro" ? "choosePro" : "chooseBusiness"} />
                </Link>
              </article>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl px-5 text-center sm:px-8">
          <Link
            href="/billing"
            className="inline-flex rounded-xl bg-[#173D32] px-6 py-3.5 font-semibold text-white hover:bg-[#0E2C24]"
          >
            <TranslatedText id="secureCheckout" />
          </Link>
        </div>
      </section>

      <section
        id="about"
        className="scroll-mt-20 border-y border-[#173D32]/10 bg-[#EEE9DC] py-20"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">
              <TranslatedText id="designedForClarity" />
            </p>
            <h2 className="mt-6 [font-size:clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-[#0E2C24]">
              <TranslatedText id="aboutTitle" />
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[#173D32]/10 bg-[#FCFBF7]/75 p-5 text-base font-medium text-[#344039]"
              >
                <span className="text-[#173D32]">
                  <CheckIcon />
                </span>
                <TranslatedText id={item} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 text-center sm:py-32">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="[font-size:clamp(2.5rem,5.5vw,4.25rem)] font-semibold leading-[1.01] tracking-[-0.055em] text-[#0E2C24]">
            <TranslatedText id="finalTitle" />
          </h2>
          <p className="mt-7 [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">
            <TranslatedText id="finalDescription" />
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-flex items-center gap-2 rounded-xl bg-[#173D32] px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]"
          >
            <TranslatedText id="startBuilding" /> <ArrowIcon />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#173D32]/10 bg-[#F1EDDF] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 text-sm text-[#68706B] sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <p className="font-semibold text-[#173D32]">Buzypeezy</p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <a href="#how-it-works" className="hover:text-[#173D32]">
                <TranslatedText id="howItWorks" />
              </a>
              <a href="#pricing" className="hover:text-[#173D32]">
                <TranslatedText id="pricing" />
              </a>
              <Link href="/login" className="hover:text-[#173D32]">
                <TranslatedText id="login" />
              </Link>
              <Link href="/signup" className="hover:text-[#173D32]">
                <TranslatedText id="startBuilding" />
              </Link>
            </div>
            <p><TranslatedText id="footerTagline" /></p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#173D32]/10 pt-6">
            <Link href="/privacy" className="hover:text-[#173D32]">
              <TranslatedText id="privacyPolicy" />
            </Link>
            <Link href="/terms" className="hover:text-[#173D32]">
              <TranslatedText id="termsOfService" />
            </Link>
            <Link href="/refund-cancellation" className="hover:text-[#173D32]">
              <TranslatedText id="refundCancellation" />
            </Link>
            <Link href="/contact-support" className="hover:text-[#173D32]">
              <TranslatedText id="contactSupport" />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
