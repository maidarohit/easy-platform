"use client";

import { useEffect, useState } from "react";

type TutorialArea = "easy-mode" | "master-workspace";

const STEPS = [
  { title: "Describe your business", easyMode: "Start with a few simple details about what your business does.", masterWorkspace: "Your saved business details keep every part of the workspace connected." },
  { title: "Choose your goal", easyMode: "Pick what you want to achieve first. You can focus on one clear goal at a time.", masterWorkspace: "Your chosen goal helps organize the work you review here." },
  { title: "Buzypeezy builds the required parts", easyMode: "Easy Mode prepares the right steps and builds them in a clear order.", masterWorkspace: "Each completed part appears in its matching workspace card." },
  { title: "Review everything in Master Workspace", easyMode: "Open Master Workspace to see all your business work together in one place.", masterWorkspace: "Open each card to check the latest output before you decide what comes next." },
  { title: "Approve, regenerate, or Go Live", easyMode: "Review the results, keep what works, or ask for a new version before going live.", masterWorkspace: "Approve work you are happy with, regenerate what needs changes, then use the relevant tool to go live." },
] as const;

export default function ProductTutorial({ area }: { area: TutorialArea }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const storageKey = `buzypeezy:tutorial-viewed:${area}`;
  const isEasyMode = area === "easy-mode";

  useEffect(() => {
    let shouldOpen = true;
    try {
      shouldOpen = window.localStorage.getItem(storageKey) !== "true";
    } catch {
      // Show the guide when browser storage is unavailable.
    }
    if (!shouldOpen) return;
    const timeoutId = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [storageKey]);

  function closeTutorial() {
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // The tutorial still works when browser storage is unavailable.
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTutorial();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const currentStep = STEPS[step];

  return (
    <>
      <button type="button" onClick={() => { setStep(0); setOpen(true); }} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#A8B8A7] bg-white/80 px-4 text-sm font-semibold text-[#173D32] transition hover:border-[#173D32] hover:bg-white">
        Help / Tutorial
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102A23]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTutorial(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`${area}-tutorial-title`} className="w-full max-w-xl rounded-[28px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 text-[#1B211E] shadow-[0_30px_90px_rgba(16,42,35,0.3)] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">{isEasyMode ? "Easy Mode guide" : "Master Workspace guide"}</p>
                <p className="mt-2 text-sm text-[#606A64]">Step {step + 1} of {STEPS.length}</p>
              </div>
              <button type="button" onClick={closeTutorial} aria-label="Close tutorial" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8DCCF] text-xl text-[#606A64] hover:bg-[#EEE9DC]">×</button>
            </div>

            <div className="mt-8 flex gap-2" aria-hidden="true">
              {STEPS.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[#173D32]" : "bg-[#D8DCCF]"}`} />)}
            </div>

            <div className="py-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEE9DC] text-lg font-semibold text-[#173D32]">{step + 1}</div>
              <h2 id={`${area}-tutorial-title`} className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#173D32] sm:text-3xl">{currentStep.title}</h2>
              <p className="mt-4 text-base leading-7 text-[#606A64]">{isEasyMode ? currentStep.easyMode : currentStep.masterWorkspace}</p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#D8DCCF] pt-5">
              <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="min-h-11 rounded-full px-4 text-sm font-semibold text-[#606A64] disabled:invisible">Back</button>
              {step < STEPS.length - 1
                ? <button type="button" onClick={() => setStep((current) => current + 1)} className="min-h-11 rounded-full bg-[#173D32] px-6 text-sm font-semibold text-white hover:bg-[#235849]">Next</button>
                : <button type="button" onClick={closeTutorial} className="min-h-11 rounded-full bg-[#173D32] px-6 text-sm font-semibold text-white hover:bg-[#235849]">Got it</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
