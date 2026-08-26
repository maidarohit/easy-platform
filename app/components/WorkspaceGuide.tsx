"use client";

import { useEffect, useState } from "react";

const WORKSPACE_STEPS = [
  { title: "Your business stays connected", description: "Confirmed business details and Project Memory keep every workspace section aligned." },
  { title: "See what is ready", description: "Completed work appears as Ready. Anything that was not part of the build remains clearly marked Not generated." },
  { title: "Review the latest output", description: "Open each Ready card to read the latest saved result without starting another workflow." },
  { title: "Approve what works", description: "Approve outputs you are happy with while keeping the saved work connected to this project." },
  { title: "Continue when you choose", description: "Use an advanced tool only when you intentionally want to work on that area." },
] as const;

export default function WorkspaceGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const current = WORKSPACE_STEPS[step];
  return (
    <>
      <button type="button" onClick={() => { setStep(0); setOpen(true); }} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#D8DCCF] bg-white/70 px-4 text-sm font-semibold text-[#606A64] transition hover:border-[#A8B8A7] hover:text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2">Workspace Guide</button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102A23]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="workspace-guide-title" className="w-full max-w-xl rounded-[28px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 text-[#1B211E] shadow-[0_30px_90px_rgba(16,42,35,0.3)] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">Master Workspace Guide</p>
                <p className="mt-2 text-sm text-[#606A64]">Step {step + 1} of {WORKSPACE_STEPS.length}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close workspace guide" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8DCCF] text-xl text-[#606A64] hover:bg-[#EEE9DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">×</button>
            </div>
            <div className="mt-8 flex gap-2" aria-hidden="true">
              {WORKSPACE_STEPS.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[#173D32]" : "bg-[#D8DCCF]"}`} />)}
            </div>
            <div className="py-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEE9DC] text-lg font-semibold text-[#173D32]">{step + 1}</div>
              <h2 id="workspace-guide-title" className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#173D32] sm:text-3xl">{current.title}</h2>
              <p className="mt-4 text-base leading-7 text-[#606A64]">{current.description}</p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[#D8DCCF] pt-5">
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="min-h-11 rounded-full px-4 text-sm font-semibold text-[#606A64] disabled:invisible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Back</button>
              {step < WORKSPACE_STEPS.length - 1
                ? <button type="button" onClick={() => setStep((value) => value + 1)} className="min-h-11 rounded-full bg-[#173D32] px-6 text-sm font-semibold text-white hover:bg-[#235849] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2">Next</button>
                : <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full bg-[#173D32] px-6 text-sm font-semibold text-white hover:bg-[#235849] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2">Got it</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
