import Link from "next/link";

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M4 10h12m-4-4 4 4-4 4" /></svg>
);

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m4 10 4 4 8-8" /></svg>
);

const outcomeIcons = [
  <svg key="direction" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><circle cx="12" cy="12" r="8" /><path d="m14.8 9.2-1.6 4-4 1.6 1.6-4z" /></svg>,
  <svg key="presence" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M4 5h16v14H4zM4 9h16" /><path d="M8 14h3m2 0h3" /></svg>,
  <svg key="reach" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><circle cx="8" cy="12" r="3" /><circle cx="17" cy="7" r="2" /><circle cx="17" cy="17" r="2" /><path d="m10.5 10.5 4.7-2.4m-4.7 5.4 4.7 2.4" /></svg>,
  <svg key="growth" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M4 18 10 12l4 3 6-8" /><path d="M15 7h5v5" /></svg>,
];

export default function Home() {
  const outcomes = [
    ["Start Strong", "Turn an idea into a clear business direction."],
    ["Look Professional", "Build a credible, consistent presence customers can trust."],
    ["Reach More People", "Create the systems needed to attract the right customers."],
    ["Keep Growing", "Understand what is working and what Buzypeezy recommends next."],
  ];
  const steps = [
    ["Tell us about your business", "Write naturally. You don’t need to know technical terms."],
    ["Buzypeezy understands what you need", "Your goals, customers and direction are organised automatically."],
    ["Your business system is created", "Everything works together from one shared business understanding."],
    ["Review, improve and launch", "You stay in control and can refine anything later."],
  ];
  const overview = ["Your direction", "Your digital presence", "Your customer growth system", "Your business content", "Your performance overview", "Recommended next actions"];
  const plans = [
    { name: "Pro", price: "₹1,999", period: "/month", description: "The complete Buzypeezy workspace for growing your business.", features: ["Connected business workspace", "AI business tools", "Saved projects and outputs"] },
    { name: "Business", price: "₹4,999", period: "/month", description: "Expanded capacity for established businesses and teams.", features: ["Everything in Pro", "Expanded business capacity", "Priority business support"], featured: true },
    { name: "Enterprise", price: "Custom", period: "", description: "Flexible capacity for organisations with broader needs.", features: ["Tailored business capacity", "Connected team workflows", "Dedicated support"] },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F4EC] text-[#1B211E] selection:bg-[#A8B8A7]/50">
      <nav className="sticky top-0 z-50 border-b border-[#173D32]/10 bg-[#F7F4EC]/90 backdrop-blur-xl" aria-label="Primary navigation">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-2xl font-semibold tracking-[-0.03em] text-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Buzypeezy</Link>
          <div className="hidden items-center gap-8 [font-size:clamp(0.9375rem,1.1vw,1.0625rem)] font-medium text-[#52605A] md:flex">
            <a href="#how-it-works" className="transition hover:text-[#173D32]">How it Works</a>
            <a href="#for-business" className="transition hover:text-[#173D32]">For Business</a>
            <a href="#pricing" className="transition hover:text-[#173D32]">Pricing</a>
            <a href="#about" className="transition hover:text-[#173D32]">About</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="rounded-lg px-2 py-2 text-[15px] font-semibold text-[#173D32] transition hover:bg-[#EEE9DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] sm:px-3">Log in</Link>
            <Link
  href="/idea-finder"
  className="rounded-lg px-3 py-2 text-[15px] font-semibold text-[#173D32] transition hover:bg-[#173D32]/5"
>
  Find a Business Idea
</Link>
            <Link href="/signup" className="rounded-xl bg-[#173D32] px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(23,61,50,0.16)] transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61] sm:px-5">Start Building</Link>
          </div>
        </div>
      </nav>

      <section className="relative border-b border-[#173D32]/10 py-20 sm:py-28 lg:py-32">
        <div className="pointer-events-none absolute -left-44 top-10 h-96 w-96 rounded-full bg-[#A8B8A7]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#DCCBAA]/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">Business, made easier</p>
            <h1 className="mt-7 max-w-4xl [font-size:clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-[#1B211E]">Your business.<br /><span className="text-[#173D32]">Built intelligently.</span></h1>
            <p className="mt-8 max-w-2xl [font-size:clamp(1.0625rem,1.7vw,1.375rem)] leading-[1.65] text-[#626A64]">Tell Buzypeezy what you do and where you want to go. We’ll turn it into a complete digital business system — ready to build, grow and improve.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173D32] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(23,61,50,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]">Start Building <ArrowIcon /></Link>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-[#173D32]/20 bg-[#FCFBF7]/70 px-6 py-3.5 text-sm font-semibold text-[#173D32] transition hover:-translate-y-0.5 hover:border-[#173D32]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">See How It Works</a>
            </div>
          </div>

          <div className="relative rounded-[32px] border border-[#173D32]/15 bg-[#FCFBF7] p-6 shadow-[0_30px_80px_rgba(40,52,45,0.10)] sm:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#B89A61] to-transparent" />
            <div className="flex items-center justify-between border-b border-[#173D32]/10 pb-5"><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#738174]">Your business · Example preview</p><h2 className="mt-2 text-2xl font-semibold text-[#0E2C24]">MAYA Realty</h2><p className="mt-1 text-sm text-[#717872]">Luxury Real Estate • Bangalore</p></div><div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#B89A61]/35 bg-[#F4EEE1] text-[#8A713F]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5"><path d="M4 20V9l8-5 8 5v11M8 20v-7h8v7" /></svg></div></div>
            <div className="mt-6 space-y-3">
              {[
                ["Understanding your business", "complete"],
                ["Building your direction", "complete"],
                ["Creating your digital presence", "active"],
                ["Preparing your growth system", "upcoming"],
              ].map(([label, status], index) => <div key={label} className={`flex items-center gap-4 rounded-2xl border px-4 py-4 ${status === "active" ? "border-[#B89A61]/35 bg-[#F6F0E4]" : "border-[#173D32]/8 bg-white/60"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${status === "complete" ? "bg-[#173D32] text-white" : status === "active" ? "bg-[#B89A61] text-white" : "bg-[#EEE9DC] text-[#8A918C]"}`}>{status === "complete" ? <CheckIcon /> : `0${index + 1}`}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[#27332E]">{label}</p><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7A817C]">{status}</span></div>{status === "active" && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DDD6C7]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#173D32]" /></div>}</div></div>)}
            </div>
            <p className="mt-6 text-center text-sm font-medium text-[#52605A]">Buzypeezy is taking care of it.</p>
          </div>
        </div>
      </section>

      <section id="for-business" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">Built around your business</p><h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">One place to move your business forward.</h2><p className="mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">You don’t need to understand complex tools or connect disconnected systems. Start with one business brief and Buzypeezy coordinates what your business needs around the same clear direction.</p></div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{outcomes.map(([title, description], index) => <article key={title} className="group rounded-[24px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_15px_40px_rgba(40,52,45,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#173D32]/20 hover:shadow-[0_20px_45px_rgba(40,52,45,0.09)]"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#173D32]/15 bg-[#EDF0E8] text-[#173D32]">{outcomeIcons[index]}</div><h3 className="mt-8 [font-size:clamp(1.5rem,2vw,1.75rem)] font-semibold leading-tight text-[#0E2C24]">{title}</h3><p className="mt-4 [font-size:clamp(1rem,1.2vw,1.125rem)] leading-[1.7] text-[#6F756F]">{description}</p></article>)}</div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-[#EEE9DC] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">How it works</p><h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">From what you know to what your business needs.</h2></div><div className="mt-14 grid gap-4 lg:grid-cols-4">{steps.map(([title, description], index) => <article key={title} className="relative rounded-[24px] border border-[#173D32]/10 bg-[#FCFBF7]/85 p-7"><p className="text-base font-semibold text-[#B89A61]">0{index + 1}</p><h3 className="mt-8 [font-size:clamp(1.375rem,1.8vw,1.625rem)] font-semibold leading-tight text-[#0E2C24]">{title}</h3><p className="mt-4 [font-size:clamp(1rem,1.15vw,1.125rem)] leading-[1.7] text-[#6F756F]">{description}</p>{index < 3 && <span className="absolute -right-3 top-8 z-10 hidden text-[#A8B8A7] lg:block">→</span>}</article>)}</div></div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 text-center sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">Begin naturally</p><h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">Start with what you already know.</h2><p className="mx-auto mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">You don’t need a strategy document. Just tell Buzypeezy about your business in your own words.</p><div className="relative mt-12 rounded-[30px] border border-[#173D32]/15 bg-[#FCFBF7] p-7 text-left shadow-[0_25px_70px_rgba(40,52,45,0.09)] sm:p-12"><div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-[#B89A61] to-transparent" /><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7C857E]">Tell Buzypeezy about your business</p><blockquote className="mt-6 [font-size:clamp(1.5rem,3vw,2.25rem)] leading-[1.45] tracking-[-0.025em] text-[#27332E]">“I run a luxury real estate company in Bangalore and want to attract more serious buyers.”</blockquote><div className="mt-9 flex justify-end"><Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#173D32] px-5 py-3 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]">Continue with Buzypeezy <ArrowIcon /></Link></div></div></div>
      </section>

      <section className="bg-[#173D32] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D6C49D]">Connected outcomes</p><h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em]">See your business as one complete picture.</h2><p className="mt-6 [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#C1CBC5]">Everything stays connected to the same business understanding, so every next action has context.</p></div><div className="grid gap-3 sm:grid-cols-2">{overview.map((item, index) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D6C49D] text-sm font-semibold text-[#173D32]">0{index + 1}</span><span className="text-base font-medium">{item}</span></div>)}</div></div>
      </section>

      <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">Simple plans</p><h2 className="mt-6 [font-size:clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[#0E2C24]">Choose what fits your business.</h2><p className="mx-auto mt-6 max-w-3xl [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">Start with the capacity you need today and move forward as your business grows.</p></div><div className="mt-14 grid gap-6 lg:grid-cols-3">{plans.map((plan) => <article key={plan.name} className={`relative rounded-[28px] border p-8 transition hover:-translate-y-1 ${plan.featured ? "border-[#173D32] bg-[#EDF0E8] shadow-[0_24px_60px_rgba(23,61,50,0.12)]" : "border-[#173D32]/10 bg-[#FCFBF7]"}`}>{plan.featured && <span className="absolute right-5 top-5 rounded-full bg-[#173D32] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">Most selected</span>}<h3 className="text-2xl font-semibold text-[#0E2C24]">{plan.name}</h3><div className="mt-8 flex items-end gap-1"><span className="[font-size:clamp(3.5rem,5vw,4rem)] font-semibold leading-none tracking-[-0.05em] text-[#0E2C24]">{plan.price}</span><span className="pb-1 text-base text-[#747B76]">{plan.period}</span></div><p className="mt-6 min-h-14 text-base leading-7 text-[#6F756F]">{plan.description}</p><ul className="mt-8 space-y-4">{plan.features.map((feature) => <li key={feature} className="flex items-center gap-3 text-base text-[#46514B]"><span className="text-[#173D32]"><CheckIcon /></span>{feature}</li>)}</ul><Link href="/signup" className={`mt-9 inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61] ${plan.featured ? "bg-[#173D32] text-white hover:bg-[#0E2C24]" : "border border-[#173D32]/20 text-[#173D32] hover:border-[#173D32]/40 hover:bg-[#EDF0E8]"}`}>Start Building</Link></article>)}</div></div>
        <div className="mx-auto mt-10 max-w-7xl px-5 text-center sm:px-8"><Link href="/billing" className="inline-flex rounded-xl bg-[#173D32] px-6 py-3.5 font-semibold text-white hover:bg-[#0E2C24]">Continue to secure checkout</Link></div>
      </section>

      <section id="about" className="scroll-mt-20 border-y border-[#173D32]/10 bg-[#EEE9DC] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6E774D]">Designed for clarity</p><h2 className="mt-6 [font-size:clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-[#0E2C24]">Built for businesses that want simplicity without losing control.</h2></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Secure account access", "Your projects stay organised", "You remain in control", "Built to grow with your business"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#173D32]/10 bg-[#FCFBF7]/75 p-5 text-base font-medium text-[#344039]"><span className="text-[#173D32]"><CheckIcon /></span>{item}</div>)}</div></div>
      </section>

      <section className="py-24 text-center sm:py-32"><div className="mx-auto max-w-4xl px-5"><h2 className="[font-size:clamp(2.5rem,5.5vw,4.25rem)] font-semibold leading-[1.01] tracking-[-0.055em] text-[#0E2C24]">Ready to make your business easier?</h2><p className="mt-7 [font-size:clamp(1rem,1.5vw,1.25rem)] leading-[1.75] text-[#6F756F]">Start with what you know. Buzypeezy will help organise what comes next.</p><Link href="/signup" className="mt-9 inline-flex items-center gap-2 rounded-xl bg-[#173D32] px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B89A61]">Start Building <ArrowIcon /></Link></div></section>

      <footer className="border-t border-[#173D32]/10 bg-[#F1EDDF] py-10"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 text-sm text-[#68706B] sm:px-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><p className="font-semibold text-[#173D32]">Buzypeezy</p><div className="flex flex-wrap gap-x-6 gap-y-3"><a href="#how-it-works" className="hover:text-[#173D32]">How it Works</a><a href="#pricing" className="hover:text-[#173D32]">Pricing</a><Link href="/login" className="hover:text-[#173D32]">Log in</Link><Link href="/signup" className="hover:text-[#173D32]">Start Building</Link></div><p>Built to make business simpler.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#173D32]/10 pt-6"><Link href="/privacy" className="hover:text-[#173D32]">Privacy Policy</Link><Link href="/terms" className="hover:text-[#173D32]">Terms of Service</Link><Link href="/refund-cancellation" className="hover:text-[#173D32]">Refund &amp; Cancellation</Link><Link href="/contact-support" className="hover:text-[#173D32]">Contact &amp; Support</Link></div></div></footer>
    </main>
  );
}
