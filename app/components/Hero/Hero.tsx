 export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center pt-20 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl"></div>

<div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl"></div>
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        {/* Left Side */}
<div className="space-y-8">

          <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-md">
            🚀 AI Platform for Modern Businesses
          </span>

          <h1 className="text-6xl md:text-7xl font-extrabold leading-[1.05] tracking-tight text-white">
  Build Your <br />

  <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
    AI Business
  </span>

  <br />

  Faster Than Ever.
</h1>

          <p className="max-w-xl text-lg leading-8 text-slate-300">
            Launch AI employees, automate your company,
            manage workflows and scale your business from one platform.
          </p>

          <div className="flex gap-4">

            <button className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,.35)] transition hover:scale-105">
              Start Free
            </button>

            <button className="rounded-xl border border-white/20 px-8 py-4 text-white transition hover:border-cyan-400 hover:bg-white/5">
              Watch Demo
            </button>

          </div>

        </div>

        {/* Right Side */}

        <div className="max-w-xl ml-auto rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-2xl shadow-[0_0_80px_rgba(59,130,246,0.15)]">

          <h3 className="mb-8 text-2xl font-bold text-white">
  AI Dashboard
</h3>

          <div className="space-y-4">

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md">
  <span className="text-white">🤖 Sales AI</span>

  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-green-400"></div>
    <span className="text-sm text-green-400">Running</span>
  </div>
</div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md">
  <span className="text-white">🎨 Branding AI</span>

  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-green-400"></div>
    <span className="text-sm text-green-400">Running</span>
  </div>
</div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md">
  <span className="text-white">📈 Marketing AI</span>

  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-green-400"></div>
    <span className="text-sm text-green-400">Running</span>
  </div>
</div>

<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md">
  <span className="text-white">🌐 Website AI</span>

  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-green-400"></div>
    <span className="text-sm text-green-400">Running</span>
  </div>
</div>

          </div>

        </div>
</div>
    </section>
  );
}