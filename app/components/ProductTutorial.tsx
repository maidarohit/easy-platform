"use client";

import { useEffect, useState, type ReactNode } from "react";

export const GETTING_STARTED_VIDEO_PATH =
  "/tutorials/buzypeezy-getting-started-en.mp4";

export const GETTING_STARTED_CAPTIONS_PATH =
  "/videos/buzypeezy-getting-started.vtt";

const TUTORIAL_LANGUAGES = [
  {
    id: "en",
    label: "English",
    src: "/tutorials/buzypeezy-getting-started-en.mp4",
  },
  {
    id: "hi",
    label: "हिंदी",
    src: "/tutorials/buzypeezy-getting-started-hi.mp4",
  },
  {
    id: "ar",
    label: "العربية",
    src: "/tutorials/buzypeezy-getting-started-ar.mp4",
  },
] as const;

type TutorialLanguage = (typeof TUTORIAL_LANGUAGES)[number]["id"];
export const GETTING_STARTED_TUTORIAL_KEY = "buzypeezy:tutorial-viewed:getting-started";

type ProductTutorialProps = Readonly<{
  area: "homepage" | "onboarding" | "easy-mode" | "master-workspace";
  mode?: "entry" | "replay";
  onComplete?: () => void;
  trigger?: ReactNode;
  triggerClassName?: string;
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
  const [language, setLanguage] = useState<TutorialLanguage>("en");

  const selectedVideo =
    TUTORIAL_LANGUAGES.find((item) => item.id === language) ??
    TUTORIAL_LANGUAGES[0];

  if (!requested) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[22px] bg-[#173D32] px-6 text-center text-white">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 text-xl"
        >
          ▶
        </span>

        <p className="mt-4 font-semibold">
          Your Buzypeezy getting-started guide
        </p>

        <p className="mt-2 max-w-md text-sm leading-6 text-white/75">
          Watch a quick walkthrough of how to create and manage your business.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-[#606A64]">
          Choose language:
        </span>

        {TUTORIAL_LANGUAGES.map((item) => {
          const active = language === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLanguage(item.id);
                setMissing(false);
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[#173D32] bg-[#173D32] text-white"
                  : "border-[#D8DCCF] bg-white text-[#173D32] hover:bg-[#F4F1E8]"
              }`}
              aria-pressed={active}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {missing ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[22px] bg-[#173D32] px-6 text-center text-white">
          <p className="font-semibold">This tutorial video could not load.</p>
          <p className="mt-2 text-sm text-white/75">
            Please choose another language or try again.
          </p>
        </div>
      ) : (
        <video
          key={selectedVideo.src}
          controls
          playsInline
          preload="metadata"
          onError={() => setMissing(true)}
          className="aspect-video w-full rounded-[22px] bg-[#173D32]"
          aria-label={`Buzypeezy getting-started tutorial in ${selectedVideo.label}`}
        >
          <source src={selectedVideo.src} type="video/mp4" />

          {language === "en" && (
            <track
              src={GETTING_STARTED_CAPTIONS_PATH}
              kind="captions"
              srcLang="en"
              label="English"
            />
          )}

          Your browser does not support video playback.
        </video>
      )}
    </div>
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

export default function ProductTutorial({ area, mode = "replay", onComplete, trigger = "Help / Tutorial", triggerClassName }: ProductTutorialProps) {
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
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName ?? "inline-flex min-h-10 items-center justify-center rounded-full border border-[#A8B8A7] bg-white/80 px-4 text-sm font-semibold text-[#173D32] transition hover:border-[#173D32] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32] focus-visible:ring-offset-2"}>{trigger}</button>
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
