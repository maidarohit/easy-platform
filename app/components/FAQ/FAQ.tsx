"use client";

import { useState } from "react";

export default function FAQ() {const [openIndex, setOpenIndex] = useState<number | null>(0);

const faqs = [
  {
    question: "What is AI Manager?",
    answer:
      "AI Manager acts as your central coordinator. It understands your request and assigns work to the right AI employees, ensuring every task is completed efficiently.",
  },
  {
    question: "Do I need technical knowledge?",
    answer:
      "No. Our platform is designed for everyone. Simply describe what you need, and the AI team takes care of the rest.",
  },
  {
    question: "Which AI models do you use?",
    answer:
      "We integrate leading AI models such as OpenAI, Google Gemini, Claude, and others depending on the workflow to provide the best possible results.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. You can upgrade, downgrade, or cancel your subscription whenever you want with no long-term commitment.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. We follow industry best practices to keep your data protected, private, and secure throughout every workflow.",
  },
];
  return (
    <section className="relative overflow-hidden bg-slate-950 py-28">

      {/* Background Glow */}

      <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-5xl px-6">

  {/* Heading */}

  <div className="text-center">

    <span className="inline-flex rounded-full border border-cyan-500/30 bg-white/5 px-5 py-2 text-sm font-medium text-cyan-300 backdrop-blur-xl">
      FAQ
    </span>

    <h2 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold text-white md:text-6xl">
      Frequently Asked{" "}
      <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
        Questions
      </span>
    </h2>

    <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-300">
      Everything you need to know about our AI platform,
      services, pricing, and how we help businesses grow.
    </p>

  </div>
  {/* FAQ Accordion */}

<div className="mt-20 space-y-6">

  {faqs.map((faq, index) => (

    <div
      key={index}
      className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/40"
    >

      <button
        onClick={() =>
          setOpenIndex(openIndex === index ? null : index)
        }
        className="flex w-full items-center justify-between px-8 py-6 text-left"
      >

        <h3 className="text-lg font-semibold text-white">
          {faq.question}
        </h3>

        <span className="text-3xl font-light text-cyan-400">
          {openIndex === index ? "−" : "+"}
        </span>

      </button>

      {openIndex === index && (

        <div className="border-t border-white/10 px-8 pb-8 pt-6">

          <p className="leading-8 text-slate-300">
            {faq.answer}
          </p>

        </div>

      )}

    </div>

  ))}

</div>
{/* Contact Card */}

<div className="mt-20 rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-10 text-center backdrop-blur-xl">

  <h3 className="text-3xl font-bold text-white">
    Still have questions?
  </h3>

  <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
    Our team is here to help you understand how our AI platform can
    transform your business. We&apos;d love to answer your questions.
  </p>

  <button className="mt-8 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,.45)]">
    Contact Our Team
  </button>

</div>

</div>

    </section>
  );
}
