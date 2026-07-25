 export default function WhyChooseUs() {
  const benefits = [
    {
      icon: "⚡",
      title: "Lightning Fast",
      description:
        "Launch AI employees and automate business workflows in minutes instead of weeks.",
    },
    {
      icon: "🤖",
      title: "AI Employees",
      description:
        "Sales, Marketing, SEO, Content and Support agents working 24/7 for your business.",
    },
    {
      icon: "📈",
      title: "Business Growth",
      description:
        "Scale faster with intelligent automation that reduces manual work and increases productivity.",
    },
    {
      icon: "🔒",
      title: "Enterprise Security",
      description:
        "Secure infrastructure, encrypted data, and reliable automation built for modern businesses.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 py-24">
      {/* Background Glow */}
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
      <div className="absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        {/* Heading */}
        <div className="text-center">
          <span className="inline-block rounded-full border border-cyan-500/30 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-300 backdrop-blur-md">
            Why Choose Us
          </span>

          <h2 className="mt-6 text-5xl font-extrabold text-white">
            Built For{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Modern Businesses
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-slate-300">
            Everything you need to automate, grow and manage your business
            with intelligent AI employees.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => (
            <div
              key={item.title}
              className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:border-cyan-400/40 hover:shadow-[0_0_40px_rgba(34,211,238,0.25)]"
            >
              <div className="text-5xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                {item.icon}
              </div>

              <h3 className="mt-6 text-2xl font-bold text-white group-hover:text-cyan-300">
                {item.title}
              </h3>

              <p className="mt-4 leading-7 text-slate-300">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}