export default function Testimonials() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-28">

      {/* Background Glow */}

      <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">

  {/* Heading */}

  <div className="text-center">

    <span className="inline-flex rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-xl">
      Testimonials
    </span>

    <h2 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold text-white md:text-6xl">
      Trusted by{" "}
      <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
        Businesses
      </span>
    </h2>

    <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-300">
      See how businesses use our AI employees to automate work,
      save time, and grow faster.
    </p>
    <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-slate-300">

  <div className="flex items-center gap-2">
    <span className="text-yellow-400 text-xl">★★★★★</span>
    <span>4.9/5 Rating</span>
  </div>

  <div className="h-6 w-px bg-white/20"></div>

  <div>500+ Businesses</div>

  <div className="h-6 w-px bg-white/20"></div>

  <div>10,000+ AI Tasks Completed</div>

</div>

  </div>
  {/* Testimonial Cards */}

<div className="mt-20 grid gap-8 md:grid-cols-3">

  {[
    {
      name: "Sarah Johnson",
      company: "TechNova",
      review:
        "The AI Manager transformed our workflow. We save hours every week and our team focuses on growth instead of repetitive tasks.",
    },
    {
      name: "Michael Chen",
      company: "GrowthLabs",
      review:
        "Our website, branding, SEO and marketing were delivered in one place. It feels like having an entire AI team working 24/7.",
    },
    {
      name: "Emily Davis",
      company: "FutureScale",
      review:
        "Professional, fast and incredibly easy to use. This platform became an essential part of our business operations.",
    },
  ].map((testimonial) => (

    <div
      key={testimonial.name}
      className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]"
    >

      {/* Stars */}

      <div className="text-yellow-400 text-xl">
        ★★★★★
      </div>

      {/* Review */}

      <p className="mt-6 leading-8 text-slate-300">
        &quot;{testimonial.review}&quot;
      </p>

      {/* Avatar */}

      <div className="mt-8 flex items-center">

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-xl font-bold text-white">
          {testimonial.name.charAt(0)}
        </div>

        <div className="ml-4">

          <h4 className="font-bold text-white">
            {testimonial.name}
          </h4>

          <p className="text-sm text-slate-400">
            {testimonial.company}
          </p>

        </div>

      </div>

    </div>

  ))}

</div>

</div>

    </section>
  );
}
