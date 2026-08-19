"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
type BusinessIdea = {
  title: string;
  whyItFits: string;
  businessModel: string;
  startupLevel: string;
  difficulty: string;
  mode: string;
  targetCustomer: string;
  firstSteps: string[];
};
export default function IdeaFinderPage() {
  const router = useRouter();
  const [interests, setInterests] = useState("");
  const [budget, setBudget] = useState("Not sure");
  const [businessType, setBusinessType] = useState("Not sure");
  const [workStyle, setWorkStyle] = useState("Not sure");
  const [skills, setSkills] = useState("");
  const [speed, setSpeed] = useState("Not sure");
  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [limitReached, setLimitReached] = useState(false);

const findIdeas = async () => {
  try {
    setLoading(true);
    setError("");
    setLimitReached(false);
    setIdeas([]);

    const response = await fetch("/api/business-ideas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        interests,
        budget,
        businessType,
        workStyle,
        skills,
        speed,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
  if (
    response.status === 429 &&
    data.code === "PUBLIC_AI_LIMIT_REACHED"
  ) {
    setLimitReached(true);
    setError(
      data.error ||
        "You've used today's free business idea generations."
    );
    return;
  }

  throw new Error(
    data.error || "Could not generate business ideas."
  );
}

    setIdeas(Array.isArray(data.ideas) ? data.ideas : []);
  } catch (err: unknown) {
  setError(
    err instanceof Error
      ? err.message
      : "Something went wrong."
  );
  } finally {
    setLoading(false);
  }
};
const buildBusiness = (idea: BusinessIdea) => {
  sessionStorage.setItem(
    "easy-selected-business-idea",
    JSON.stringify({
      idea,
      discovery: {
        interests,
        budget,
        businessType,
        workStyle,
        skills,
        speed,
      },
    })
  );

  router.push("/signup");
};

  return (
    <main className="min-h-screen bg-[#F7F4EC] text-[#1B211E]">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#173D32]"
        >
          ← Back to Buzypeezy
        </Link>

        <div className="mx-auto mt-12 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8A713F]">
            Start from zero
          </p>

          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em] text-[#0E2C24] sm:text-5xl">
            Not sure what business to start?
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#6F756F]">
            That&apos;s completely fine. Tell Buzypeezy a little about yourself and
            we&apos;ll help you discover business ideas that fit you.
          </p>

          <div className="mt-10 rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-9">
            <div>
              <label className="text-base font-semibold text-[#344039]">
                What are you interested in?
              </label>

              <p className="mt-1 text-sm text-[#7C837E]">
                Fashion, food, technology, fitness, design, travel — anything.
                You can also say you&apos;re not sure.
              </p>

              <textarea
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="Example: I like fashion and social media, but I'm not sure what business I can start."
                className="mt-4 min-h-[120px] w-full resize-none rounded-2xl border border-[#173D32]/15 bg-white p-4 text-base outline-none transition focus:border-[#173D32]/50 focus:ring-4 focus:ring-[#A8B8A7]/20"
              />
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-[#344039]">
                  How much could you invest?
                </label>

                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-3 h-13 w-full rounded-2xl border border-[#173D32]/15 bg-white px-4 outline-none"
                >
                  <option>Not sure</option>
                  <option>Very little / almost zero</option>
                  <option>Under ₹10,000</option>
                  <option>₹10,000 - ₹50,000</option>
                  <option>₹50,000 - ₹2,00,000</option>
                  <option>Above ₹2,00,000</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#344039]">
                  What kind of business sounds better?
                </label>

                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="mt-3 h-13 w-full rounded-2xl border border-[#173D32]/15 bg-white px-4 outline-none"
                >
                  <option>Not sure</option>
                  <option>Online business</option>
                  <option>Local / offline business</option>
                  <option>Either is fine</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#344039]">
                  How would you like to work?
                </label>

                <select
                  value={workStyle}
                  onChange={(e) => setWorkStyle(e.target.value)}
                  className="mt-3 h-13 w-full rounded-2xl border border-[#173D32]/15 bg-white px-4 outline-none"
                >
                  <option>Not sure</option>
                  <option>Mostly by myself</option>
                  <option>With a small team</option>
                  <option>I want to build a bigger company</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#344039]">
                  How quickly do you want to start?
                </label>

                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="mt-3 h-13 w-full rounded-2xl border border-[#173D32]/15 bg-white px-4 outline-none"
                >
                  <option>Not sure</option>
                  <option>As soon as possible</option>
                  <option>Within a month</option>
                  <option>I can take my time</option>
                </select>
              </div>
            </div>

            <div className="mt-8">
              <label className="text-base font-semibold text-[#344039]">
                Do you already have any skills?
              </label>

              <p className="mt-1 text-sm text-[#7C837E]">
                It&apos;s okay to write “I don&apos;t know” or leave this blank.
              </p>

              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Example: design, sales, cooking, editing, nothing yet..."
                className="mt-3 h-14 w-full rounded-2xl border border-[#173D32]/15 bg-white px-4 text-base outline-none transition focus:border-[#173D32]/50 focus:ring-4 focus:ring-[#A8B8A7]/20"
              />
            </div>

            <button
  type="button"
  onClick={findIdeas}
  disabled={loading || limitReached}
  className="mt-9 h-14 w-full rounded-2xl bg-[#173D32] text-base font-semibold text-white transition hover:bg-[#0E2C24] disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading
  ? "Finding ideas..."
  : limitReached
    ? "Free Limit Reached"
    : "Find My Business Ideas →"}
</button>

            <p className="mt-4 text-center text-sm text-[#8A918C]">
              No account required to explore ideas.
            </p>
          </div>
          {error && (
  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
    <p>{error}</p>

    {limitReached && (
      <div className="mt-4">
        <Link
          href="/signup"
          className="inline-flex items-center rounded-xl bg-[#173D32] px-5 py-3 font-semibold text-white transition hover:opacity-90"
        >
          Create Free Account →
        </Link>

        <p className="mt-3 text-xs text-red-600">
          Sign up to continue building your business with Buzypeezy.
        </p>
      </div>
    )}
  </div>
)}

{ideas.length > 0 && (
  <section className="mt-12">
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8A713F]">
        Your opportunities
      </p>

      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#0E2C24]">
        3 businesses worth exploring
      </h2>

      <p className="mt-3 text-base leading-7 text-[#6F756F]">
        Buzypeezy matched these ideas to what you told us. Pick the one that feels
        most interesting — you can refine everything later.
      </p>
    </div>

    <div className="mt-8 grid gap-6">
      {ideas.map((idea, index) => (
        <article
          key={`${idea.title}-${index}`}
          className="rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 shadow-[0_18px_50px_rgba(40,52,45,0.06)] sm:p-8"
        >
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">
                Idea {index + 1}
              </p>

              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#0E2C24]">
                {idea.title}
              </h3>
            </div>

            <span className="rounded-full border border-[#173D32]/10 bg-[#EEF2EA] px-3 py-1 text-xs font-semibold text-[#173D32]">
              {idea.mode}
            </span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A918C]">
                Why it fits you
              </p>
              <p className="mt-2 leading-7 text-[#4F5B55]">
                {idea.whyItFits}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A918C]">
                How it makes money
              </p>
              <p className="mt-2 leading-7 text-[#4F5B55]">
                {idea.businessModel}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#F4F1E8] p-4">
              <p className="text-xs text-[#8A918C]">Starting level</p>
              <p className="mt-1 font-semibold text-[#173D32]">
                {idea.startupLevel}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4F1E8] p-4">
              <p className="text-xs text-[#8A918C]">Difficulty</p>
              <p className="mt-1 font-semibold text-[#173D32]">
                {idea.difficulty}
              </p>
            </div>

            <div className="col-span-2 rounded-2xl bg-[#F4F1E8] p-4 sm:col-span-1">
              <p className="text-xs text-[#8A918C]">Customer</p>
              <p className="mt-1 font-semibold text-[#173D32]">
                {idea.targetCustomer}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A918C]">
              Your first steps
            </p>

            <div className="mt-3 space-y-3">
              {(idea.firstSteps || []).map(
                (step: string, stepIndex: number) => (
                  <div
                    key={stepIndex}
                    className="flex items-start gap-3 text-[#4F5B55]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#173D32] text-xs font-semibold text-white">
                      {stepIndex + 1}
                    </span>

                    <span className="leading-6">{step}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <button
  type="button"
  onClick={() => buildBusiness(idea)}
  className="mt-7 h-13 w-full rounded-2xl bg-[#173D32] font-semibold text-white transition hover:bg-[#0E2C24]"
>
  Build this business with Buzypeezy →
</button>
        </article>
      ))}
    </div>
  </section>
)}
        </div>
      </div>
    </main>
  );
}