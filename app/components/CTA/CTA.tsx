export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-28">

      {/* Background Glow */}

      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10"></div>

      <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-5xl px-6">

  <div className="rounded-[32px] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-12 text-center backdrop-blur-xl md:p-16">

    {/* Badge */}

    <span className="inline-flex rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-xl">
      Get Started Today
    </span>

    {/* Heading */}

    <h2 className="mt-8 text-5xl font-extrabold text-white md:text-6xl">

      Build Your Business With{" "}

      <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
        AI Employees
      </span>

    </h2>

    {/* Description */}

    <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-300">
      Launch faster, automate repetitive work, and scale your business
      with an intelligent AI team available 24/7.
    </p>

    {/* Buttons */}

    <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">

      <button className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_35px_rgba(34,211,238,.45)]">
        Get Started
      </button>

      <button className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-semibold text-white backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/40 hover:bg-white/10">
        Book a Demo
      </button>

    </div>

  </div>

</div>

    </section>
  );
}