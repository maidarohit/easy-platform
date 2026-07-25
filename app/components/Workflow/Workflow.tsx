 export default function Workflow() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-28">

  {/* Background Glow */}
  <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"></div>
  <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"></div>

  <div className="relative z-10 mx-auto max-w-7xl px-6">

    {/* Heading */}

    <div className="text-center">

      <span className="inline-flex rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-xl">
        How It Works
      </span>

      <h2 className="mx-auto mt-8 max-w-5xl text-5xl font-extrabold leading-tight text-white md:text-6xl">

        Your AI Business{" "}

        <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
          Workflow
        </span>

      </h2>

      <p className="mx-auto mt-8 max-w-3xl text-xl leading-8 text-slate-300">
        From one request to a fully automated business,
        your AI employees collaborate together and deliver
        a complete business solution.
      </p>

    </div>

    {/* Tell Us */}

    <div className="mt-24 flex justify-center">

      <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

        <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
          📝
        </div>

        <h3 className="mt-6 text-3xl font-bold text-white group-hover:text-cyan-300">
          Tell Us
        </h3>

        <p className="mt-4 leading-7 text-slate-300">
          Tell us about your business, goals,
          industry and vision.
        </p>

      </div>

    </div>

    <div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
      ↓
    </div>

    {/* AI Manager */}

    <div className="flex justify-center">

      <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

        <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
          🧠
        </div>

        <h3 className="mt-6 text-3xl font-bold text-white group-hover:text-cyan-300">
          AI Manager
        </h3>

        <p className="mt-4 leading-7 text-slate-300">
          Analyses your request and creates the perfect
          execution strategy.
        </p>

      </div>

    </div>

    <div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
      ↓
    </div>

    {/* AI Employees */}

    <div className="flex justify-center">

      <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

        <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
          🤖
        </div>

        <h3 className="mt-6 text-3xl font-bold text-white group-hover:text-cyan-300">
          AI Employees
        </h3>

        <p className="mt-4 leading-7 text-slate-300">
          The AI Manager delegates work to specialised AI
          employees that collaborate automatically.
        </p>

      </div>

    </div>

    <div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
      ↓
    </div>

    {/* AI Team */}

        {/* AI Team */}

<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">

  {[
    {
      icon: "🌐",
      title: "Website AI",
      desc: "Builds modern websites and landing pages."
    },
    {
      icon: "🎨",
      title: "Branding AI",
      desc: "Creates logos, colours and complete brand identity."
    },
    {
      icon: "📈",
      title: "SEO AI",
      desc: "Optimises your business for Google and search engines."
    },
    {
      icon: "✍️",
      title: "Content AI",
      desc: "Creates blogs, website copy and marketing content."
    }
  ].map((item) => (

    <div
      key={item.title}
      className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-7 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]"
    >

      <div className="text-5xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
        {item.icon}
      </div>

      <h3 className="mt-5 text-2xl font-bold text-white transition group-hover:text-cyan-300">
        {item.title}
      </h3>

      <p className="mt-4 leading-7 text-slate-300">
        {item.desc}
      </p>

    </div>

  ))}

</div>

<div className="py-10 text-center text-5xl text-cyan-400 animate-bounce">
  ↓
</div>

{/* Marketing Team */}

<div className="grid gap-8 md:grid-cols-3">

  {[
    {
      icon: "📱",
      title: "Social Media AI",
      desc: "Creates engaging social media content automatically."
    },
    {
      icon: "📧",
      title: "Email AI",
      desc: "Generates newsletters and email campaigns."
    },
    {
      icon: "💼",
      title: "Sales AI",
      desc: "Finds leads and automates your sales process."
    }
  ].map((item) => (

    <div
      key={item.title}
      className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-7 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]"
    >

      <div className="text-5xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
        {item.icon}
      </div>

      <h3 className="mt-5 text-2xl font-bold text-white transition group-hover:text-cyan-300">
        {item.title}
      </h3>

      <p className="mt-4 leading-7 text-slate-300">
        {item.desc}
      </p>

    </div>

  ))}

</div>

<div className="py-10 text-center text-5xl text-cyan-400 animate-bounce">
  ↓
</div>

{/* Analytics */}

        {/* Analytics */}

<div className="flex justify-center">

  <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

    <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
      📊
    </div>

    <h3 className="mt-6 text-3xl font-bold text-white transition group-hover:text-cyan-300">
      Analytics AI
    </h3>

    <p className="mt-4 leading-7 text-slate-300">
      Tracks business performance and continuously improves every AI employee.
    </p>

  </div>

</div>

<div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
  ↓
</div>

{/* Customer Support */}

<div className="flex justify-center">

  <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

    <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
      💬
    </div>

    <h3 className="mt-6 text-3xl font-bold text-white transition group-hover:text-cyan-300">
      Customer Support AI
    </h3>

    <p className="mt-4 leading-7 text-slate-300">
      Provides intelligent 24/7 customer support across every channel.
    </p>

  </div>

</div>

<div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
  ↓
</div>

{/* Automation */}

<div className="flex justify-center">

  <div className="group w-80 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]">

    <div className="text-6xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
      ⚙️
    </div>

    <h3 className="mt-6 text-3xl font-bold text-white transition group-hover:text-cyan-300">
      Automation AI
    </h3>

    <p className="mt-4 leading-7 text-slate-300">
      Connects every AI employee into one seamless automated workflow.
    </p>

  </div>

</div>

<div className="py-8 text-center text-5xl text-cyan-400 animate-bounce">
  ↓
</div>

{/* Final Delivery */}

<div className="flex justify-center">

  <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 p-10 text-center shadow-[0_0_60px_rgba(34,211,238,.35)]">

    <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/10 blur-3xl"></div>
    <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl"></div>

    <div className="relative z-10">

      <div className="text-7xl">
        🚀
      </div>

      <h3 className="mt-6 text-4xl font-extrabold text-white">
        Your AI Business Is Ready
      </h3>

      <p className="mx-auto mt-5 max-w-md text-lg leading-8 text-cyan-100">
        Every AI employee has completed its task. Your brand, website, marketing, sales and automation systems are now ready to launch.
      </p>

    </div>

  </div>

</div>

</div>
</section>
  );
}