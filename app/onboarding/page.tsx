"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import auth from "../lib/auth";

const businessStages = [
  "I'm starting something new",
  "I already have a business",
] as const;

const mainGoals = [
  "Get more customers",
  "Build my business",
  "Improve my online presence",
  "Increase sales",
  "Launch something new",
  "I'm not sure — guide me",
] as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6">
      <path d="M3.5 10h13m-4.5-4 4.5 4-4.5 4" />
    </svg>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [businessStage, setBusinessStage] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

useEffect(() => {
  const storedIdea = sessionStorage.getItem("easy-selected-business-idea");

  if (!storedIdea) return;

  try {
    const saved = JSON.parse(storedIdea);
    const idea = saved?.idea ?? saved;

    if (idea?.title) {
      setBusinessDescription(idea.title);
    }
  } catch (error) {
    console.error("Could not load selected business idea:", error);
  }
}, []);
  const stepOneReady = businessDescription.trim().length > 0;
  const stepTwoReady = Boolean(
    businessName.trim() && location.trim() && businessStage && mainGoal,
  );

  const primaryButtonClass =
    "inline-flex min-h-13 items-center justify-center gap-3 rounded-[14px] bg-[#173D32] px-6 py-3.5 text-base font-semibold text-[#F7F4EC] shadow-[0_12px_30px_rgba(23,61,50,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#0E2C24] hover:shadow-[0_16px_36px_rgba(23,61,50,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F4EC] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

  const handleBuildBusiness = async () => {
    if (isSaving) return;

    if (!businessDescription.trim() || !businessName.trim() || !location.trim() || !businessStage || !mainGoal) {
      setSaveError("Please review your details and complete every field before continuing.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      setSaveError("Please sign in before creating your business project.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setCompletionMessage("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          userId: user.uid,
          name: `${businessName.trim()} Business Project`,
          companyName: businessName.trim(),
          brandDescription: businessDescription.trim(),
          location: location.trim(),
          businessStage,
          goal: mainGoal,
          originalBrief: businessDescription.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create your business project.");
      }

      setCompletionMessage("Your business project is ready.");
      sessionStorage.removeItem("easy-selected-business-idea");
      window.setTimeout(() => router.push("/dashboard"), 650);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn't create your business project. Please try again.");
      setIsSaving(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F4EC] text-[#1B211E]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-[#A8B8A7]/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-[#EEE9DC] blur-[90px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between gap-6 border-b border-[#D8DCCF] pb-5">
          <span className="text-lg font-semibold tracking-[-0.02em] text-[#173D32]">Easy Platform</span>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#606A64]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            Business setup
          </div>
        </header>

        <nav aria-label="Onboarding progress" className="mt-7 flex items-center sm:mt-9">
          {[1, 2, 3, 4].map((item, index) => (
            <div key={item} className={`flex items-center ${index < 3 ? "flex-1" : ""}`}>
              <span
                aria-current={step === item ? "step" : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold transition-colors ${
                  step === item
                    ? "border-[#173D32] bg-[#173D32] text-[#FCFBF7]"
                    : step > item
                      ? "border-[#A8B8A7] bg-[#EEE9DC] text-[#173D32]"
                      : "border-[#D8DCCF] bg-[#FCFBF7] text-[#7B847E]"
                }`}
              >
                {String(item).padStart(2, "0")}
              </span>
              {index < 3 && (
                <span className={`mx-2 h-px flex-1 sm:mx-4 ${step > item ? "bg-[#A8B8A7]" : "bg-[#D8DCCF]"}`} />
              )}
            </div>
          ))}
        </nav>

        <section className="flex flex-1 items-center py-10 sm:py-14 lg:py-16">
          <div className="mx-auto w-full max-w-4xl">
            {step === 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Let&apos;s begin</p>
                <h1 className="mt-4 max-w-3xl text-[clamp(2.65rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-[#173D32]">
                  Tell Easy about your business.
                </h1>
                <p className="mt-6 text-lg leading-8 text-[#606A64] sm:text-xl">
                  Write naturally. You don&apos;t need to know technical terms.
                </p>
                <label htmlFor="business-description" className="sr-only">Business description</label>
                <textarea
                  id="business-description"
                  value={businessDescription}
                  onChange={(event) => setBusinessDescription(event.target.value)}
                  rows={7}
                  placeholder="Example: I run a luxury real estate company in Bangalore and want to attract more serious buyers."
                  className="mt-9 w-full resize-y rounded-[24px] border border-[#D8DCCF] bg-[#FCFBF7] px-6 py-6 text-lg leading-8 text-[#1B211E] shadow-[0_18px_50px_rgba(40,52,45,0.07)] outline-none transition placeholder:text-[#8A918C] focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20 sm:px-8 sm:py-7 sm:text-xl"
                />
                <button type="button" disabled={!stepOneReady} onClick={() => setStep(2)} className={`${primaryButtonClass} mt-7`}>
                  Continue <ArrowIcon />
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Business details</p>
                <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-[#173D32]">
                  Just a few quick details.
                </h1>

                <div className="mt-9 rounded-[26px] border border-[#D8DCCF] bg-[#FCFBF7] p-5 shadow-[0_18px_50px_rgba(40,52,45,0.07)] sm:p-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#173D32]">
                      Business Name
                      <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-2.5 min-h-14 w-full rounded-[14px] border border-[#D8DCCF] bg-white px-4 text-base font-normal text-[#1B211E] outline-none transition focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />
                    </label>
                    <label className="text-sm font-semibold text-[#173D32]">
                      Location
                      <input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2.5 min-h-14 w-full rounded-[14px] border border-[#D8DCCF] bg-white px-4 text-base font-normal text-[#1B211E] outline-none transition focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" />
                    </label>
                  </div>

                  <fieldset className="mt-8">
                    <legend className="text-sm font-semibold text-[#173D32]">Business stage</legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {businessStages.map((option) => (
                        <button key={option} type="button" aria-pressed={businessStage === option} onClick={() => setBusinessStage(option)} className={`rounded-[16px] border p-4 text-left text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] ${businessStage === option ? "border-[#173D32] bg-[#EEE9DC] text-[#173D32]" : "border-[#D8DCCF] bg-white text-[#606A64] hover:border-[#A8B8A7] hover:text-[#173D32]"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="mt-8">
                    <legend className="text-sm font-semibold text-[#173D32]">Main goal</legend>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {mainGoals.map((option) => (
                        <button key={option} type="button" aria-pressed={mainGoal === option} onClick={() => setMainGoal(option)} className={`min-h-20 rounded-[16px] border p-4 text-left text-sm font-medium leading-6 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] ${mainGoal === option ? "border-[#173D32] bg-[#EEE9DC] text-[#173D32]" : "border-[#D8DCCF] bg-white text-[#606A64] hover:border-[#A8B8A7] hover:text-[#173D32]"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setStep(1)} className="min-h-13 rounded-[14px] border border-[#D8DCCF] bg-[#FCFBF7] px-5 text-sm font-semibold text-[#173D32] transition hover:border-[#A8B8A7]">Back</button>
                  <button type="button" disabled={!stepTwoReady} onClick={() => setStep(3)} className={primaryButtonClass}>Continue <ArrowIcon /></button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Business summary</p>
                <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-[#173D32]">
                  Here&apos;s what we understood.
                </h1>
                <div className="relative mt-9 overflow-hidden rounded-[26px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 shadow-[0_18px_50px_rgba(40,52,45,0.07)] sm:p-9">
                  <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#B89A61]/70 to-transparent" />
                  <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                    {[
                      ["Business Name", businessName],
                      ["Location", location],
                      ["Business Stage", businessStage],
                      ["Main Goal", mainGoal],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7B847E]">{label}</dt>
                        <dd className="mt-2 text-lg font-medium leading-7 text-[#173D32]">{value}</dd>
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7B847E]">Business Description</dt>
                      <dd className="mt-2 whitespace-pre-wrap text-base leading-8 text-[#606A64]">{businessDescription}</dd>
                    </div>
                  </dl>
                  <button type="button" onClick={() => setStep(2)} className="mt-8 rounded-[12px] border border-[#A8B8A7] px-4 py-2.5 text-sm font-semibold text-[#173D32] transition hover:bg-[#EEE9DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">
                    Edit details
                  </button>
                </div>
                <button type="button" onClick={() => setStep(4)} className={`${primaryButtonClass} mt-7`}>Looks good <ArrowIcon /></button>
              </div>
            )}

            {step === 4 && (
              <div className="mx-auto max-w-3xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#A8B8A7] bg-[#EEE9DC] text-[#173D32]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M12 3 4.5 7v10L12 21l7.5-4V7zM8.5 12l2.2 2.2 4.8-5" /></svg>
                </div>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#173D32]">Setup complete</p>
                <h1 className="mt-4 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.055em] text-[#173D32]">Ready when you are.</h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#606A64] sm:text-xl">
                  Easy will use this business understanding to prepare the right systems for you.
                </p>
                <button type="button" disabled={isSaving || Boolean(completionMessage)} onClick={handleBuildBusiness} className={`${primaryButtonClass} mt-9`}>
                  {isSaving ? "Creating your business..." : completionMessage ? "Business created" : "Build My Business"}
                  {!isSaving && !completionMessage && <ArrowIcon />}
                </button>
                {completionMessage && (
                  <p role="status" className="mx-auto mt-5 w-fit rounded-full border border-[#D8DCCF] bg-[#FCFBF7] px-4 py-2 text-sm text-[#606A64]">
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    {completionMessage}
                  </p>
                )}
                {saveError && (
                  <p role="alert" className="mx-auto mt-5 max-w-xl rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {saveError}
                  </p>
                )}
                <button type="button" onClick={() => setStep(3)} className="mt-6 block w-full text-sm font-semibold text-[#606A64] underline decoration-[#A8B8A7] underline-offset-4 transition hover:text-[#173D32]">Review details</button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
