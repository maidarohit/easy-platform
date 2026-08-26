"use client";

import { useEffect, useState } from "react";

export const GETTING_STARTED_VIDEO_PATH = "/videos/buzypeezy-getting-started.mp4";
export const GETTING_STARTED_CAPTIONS_PATH = "/videos/buzypeezy-getting-started.vtt";
export const GETTING_STARTED_TUTORIAL_KEY = "buzypeezy:tutorial-viewed:getting-started";

type ProductTutorialProps = Readonly<{
  area: "onboarding" | "easy-mode" | "master-workspace";
  mode?: "entry" | "replay";
  onComplete?: () => void;
}>;

function rememberTutorial() {
  try { window.localStorage.setItem(GETTING_STARTED_TUTORIAL_KEY, "true"); } catch {
    // Tutorial completion never blocks the customer when storage is unavailable.
  }
}

function tutorialWasCompleted() {
  try { return window.localStorage.getItem(GETTING_STARTED_TUTORIAL_KEY) === "true"; } catch { return false; }
}

function TutorialVideo({ requested }: { requested: boolean }) {
  const [missing, setMissing] = useState(false);
  if (!requested || missing) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[22px] bg-[linear-gradient(145deg,#173D32,#285D4D)] px-6 text-center text-white">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xl">▶</span>
        <p className="mt-4 font-semibold">Your Buzypeezy getting-started guide</p>
        {missing && <p role="status" className="mt-2 max-w-md text-sm leading-6 text-white/75">The video is being prepared. You can start your business now and replay it later from Help / Tutorial.</p>}
      </div>
    );
  }
  return (
    <video controls playsInline preload="metadata" aria-label="How Buzypeezy turns your business vision into a complete digital business" className="aspect-video w-full rounded-[22px] bg-[#173D32]" onError={() => setMissing(true)}>
      <source src={GETTING_STARTED_VIDEO_PATH} type="video/mp4" />
      <track src={GETTING_STARTED_CAPTIONS_PATH} kind="captions" srcLang="en" label="English" />
      Your browser does not support video playback. You can skip this tutorial and continue.
    </video>
  );
}

function TutorialPanel({ entry, onClose, onComplete }: Readonly<{ entry: boolean; onClose?: () => void; onComplete: () => void }>) {
  const [stage, setStage] = useState<"intro" | "watch" | "ready">("intro");
  const requested = stage === "watch";

  function skip() {
    rememberTutorial();
    if (entry) setStage("ready");
    else onClose?.();
  }

  function start() {
    rememberTutorial();
    onComplete();
    onClose?.();
  }

  return (
    <section className="w-full rounded-[30px] border border-[#D8DCCF] bg-[#FCFBF7] p-5 text-[#1B211E] shadow-[0_24px_80px_rgba(16,42,35,0.16)] sm:p-8" aria-labelledby="getting-started-title">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Getting started</p>
          <h1 id="getting-started-title" className="mt-3 text-[clamp(2rem,6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.05em] text-[#173D32]">See how Buzypeezy works</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#606A64] sm:text-lg">From your idea to a complete digital business — in a few simple steps.</p>
        </div>
        {!entry && <button type="button" onClick={onClose} aria-label="Close tutorial" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8DCCF] text-xl text-[#606A64] transition hover:bg-[#EEE9DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">×</button>}
      </div>

      <div className="mt-7"><TutorialVideo requested={requested} /></div>

      {stage === "ready" ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-[#606A64]">You can replay the tutorial anytime from Help / Tutorial.</p>
          <button type="button" onClick={start} className="min-h-12 rounded-[14px] bg-[#173D32] px-6 font-semibold text-white transition hover:bg-[#235849] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4">Start My Business</button>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {stage === "intro" && <button type="button" onClick={() => setStage("watch")} className="min-h-12 rounded-[14px] bg-[#173D32] px-6 font-semibold text-white transition hover:bg-[#235849] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4">Watch Tutorial</button>}
          {stage === "watch" && <button type="button" onClick={start} className="min-h-12 rounded-[14px] bg-[#173D32] px-6 font-semibold text-white transition hover:bg-[#235849] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4">Start My Business</button>}
          <button type="button" onClick={skip} className="min-h-12 rounded-[14px] border border-[#A8B8A7] bg-white px-6 font-semibold text-[#173D32] transition hover:border-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-4">Skip for now</button>
        </div>
      )}
    </section>
  );
}

export default function ProductTutorial({ area, mode = "replay", onComplete }: ProductTutorialProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(mode === "entry");

  useEffect(() => {
    if (mode !== "entry") return;
    const timeout = window.setTimeout(() => {
      if (tutorialWasCompleted()) onComplete?.();
      setChecking(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [mode, onComplete]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (mode === "entry") {
    if (checking) return <p role="status" className="text-center text-sm text-[#606A64]">Preparing your welcome...</p>;
    return <TutorialPanel entry onComplete={() => onComplete?.()} />;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#A8B8A7] bg-white/80 px-4 text-sm font-semibold text-[#173D32] transition hover:border-[#173D32] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2">Help / Tutorial</button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#102A23]/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label={`${area} getting-started tutorial`} className="w-full max-w-3xl">
            <TutorialPanel entry={false} onClose={() => setOpen(false)} onComplete={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
