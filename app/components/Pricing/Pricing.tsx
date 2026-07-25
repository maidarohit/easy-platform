 export default function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "£29",
      period: "/month",
      description: "Perfect for startups and freelancers.",
      popular: false,
    },
    {
      name: "Pro",
      price: "£79",
      period: "/month",
      description: "Best for growing businesses.",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "Tailored AI solutions for enterprises.",
      popular: false,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 py-28">

      {/* Background Glow */}

      <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">

        {/* Heading */}

        <div className="text-center">

          <span className="inline-flex rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-xl">
            Pricing
          </span>

          <h2 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold text-white md:text-6xl">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              AI Team
            </span>
          </h2>

          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-300">
            Flexible pricing designed for every stage of your business.
          </p>

        </div>

        {/* Pricing Cards */}

        <div className="mt-20 grid gap-8 lg:grid-cols-3">

          {plans.map((plan) => (

            <div
              key={plan.name}
              className={`group relative rounded-3xl border p-8 backdrop-blur-xl transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_0_45px_rgba(34,211,238,.25)]
              ${
                plan.popular
                  ? "border-cyan-400 bg-gradient-to-b from-cyan-500/20 to-white/5 scale-105"
                  : "border-white/10 bg-gradient-to-b from-white/10 to-white/5"
              }`}
            >

              {plan.popular && (

                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg">
                  ⭐ Most Popular
                </div>

              )}

              <h3 className="mt-4 text-3xl font-bold text-white">
                {plan.name}
              </h3>

              <p className="mt-6 text-5xl font-extrabold text-white">
                {plan.price}
              </p>

              <p className="mt-2 text-slate-400">
                {plan.period}
              </p>

              <p className="mt-6 leading-7 text-slate-300">
                {plan.description}
              </p>
              {/* Features */}

<ul className="mt-8 space-y-4 text-slate-300">

  <li>✅ AI Manager</li>

  <li>✅ Website AI</li>

  <li>✅ Branding AI</li>

  {plan.name !== "Starter" && (
    <li>✅ SEO AI</li>
  )}

  {plan.name !== "Starter" && (
    <li>✅ Content AI</li>
  )}

  {plan.name === "Enterprise" && (
    <li>✅ Dedicated AI Team</li>
  )}

  {plan.name === "Enterprise" && (
    <li>✅ Priority Support</li>
  )}

</ul>

<button
  className={`mt-10 w-full rounded-xl py-4 text-lg font-semibold transition-all duration-300 ${
    plan.popular
      ? "bg-cyan-500 text-white hover:bg-cyan-400"
      : "border border-cyan-400 text-cyan-300 hover:bg-cyan-500 hover:text-white"
  }`}
>
  {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
</button>

            </div>

          ))}

        </div>
        {/* Trust Note */}

<div className="mt-16 text-center">

  <p className="text-slate-400 text-lg">
    ✓ No hidden fees &nbsp; • &nbsp;
    ✓ Cancel anytime &nbsp; • &nbsp;
    ✓ Secure payments
  </p>

</div>

      </div>

    </section>
  );
}