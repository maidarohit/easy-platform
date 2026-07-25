 export default function Features() {
  const features = [
    {
      title: "Sales AI",
      description:
        "Generate leads, automate outreach, and manage your sales pipeline with AI.",
      icon: "📈",
    },
    {
      title: "Branding AI",
      description:
        "Create logos, brand identities, color palettes, and marketing assets instantly.",
      icon: "🎨",
    },
    {
      title: "Website AI",
      description:
        "Build beautiful, responsive websites without writing code.",
      icon: "🌐",
    },
    {
      title: "SEO AI",
      description:
        "Improve your Google rankings with automated SEO optimization.",
      icon: "🚀",
    },
    {
      title: "Content AI",
      description:
        "Generate blogs, ads, social media posts, and email campaigns in seconds.",
      icon: "✍️",
    },
    {
      title: "Automation AI",
      description:
        "Connect apps and automate repetitive business workflows effortlessly.",
      icon: "🤖",
    },
  ];

  return (
  <section className="relative overflow-hidden bg-slate-950 py-24">

    <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"></div>

    <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>

    <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="relative text-center">
          <div className="absolute left-1/2 top-24 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"></div>
          <span className="inline-block rounded-full border border-cyan-500/30 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-300 backdrop-blur-md">
            Platform Features
          </span>

          <h2 className="mx-auto mt-6 max-w-4xl text-center text-5xl font-extrabold leading-tight text-white">
  Everything Your Business{" "}
  <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
  Needs
</span>
</h2>

          <p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-slate-300">
            One intelligent platform that helps businesses automate,
            create, market, and scale using AI-powered employees.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_45px_rgba(34,211,238,0.25)]"
            >
              <div className="text-5xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
  {feature.icon}
</div>

              <h3 className="mt-6 text-2xl font-bold text-white transition-colors group-hover:text-cyan-300">
                {feature.title}
              </h3>

              <p className="mt-4 leading-7 text-slate-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}