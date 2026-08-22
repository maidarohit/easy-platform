"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";

function CreativeAIPageContent() {
  const router = useRouter();
const { projectId } = useProjectMemory();
const [prompt, setPrompt] = useState("");

const handleGenerateCreativeProject = () => {
  if (!prompt.trim()) {
    alert("Please describe your creative project.");
    return;
  }

  localStorage.setItem(
    "easy-platform-creative-prompt",
    prompt
  );

  router.push(
  projectId
    ? `/dashboard/content-ai?projectId=${encodeURIComponent(projectId)}`
    : "/dashboard/content-ai"
);
};
  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />

      <section className="min-w-0 flex-1">
        <Navbar />
        <div className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-500/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-3xl" />

          <header className="relative mb-9 flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5">
                <path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z" />
                <path d="m8 10 4-2 4 2v4l-4 2-4-2v-4Z" />
                <path d="M12 8V3M16 10l5-2M16 14l5 2M12 16v5M8 14l-5 2M8 10 3 8" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Creative Intelligence</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Creative Systems</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Create logo concepts, images, presentations, marketing content, videos and automate your social media—all from one place.
              </p>
            </div>
          </header>

          <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
            <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Intelligence Input</span>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">What would you like to create today?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Describe the objective, format, audience and visual direction.</p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M4.7 15.3l2.1-2.1M13.2 6.8l2.1-2.1"/><circle cx="10" cy="10" r="3"/></svg>
              </div>
            </div>

            <div className="relative mt-5 rounded-2xl border border-white/[0.08] bg-slate-950/80 p-1 shadow-[inset_0_0_22px_rgba(0,0,0,0.3)] transition-all duration-300 focus-within:border-red-400/45 focus-within:shadow-[inset_0_0_22px_rgba(0,0,0,0.3),0_0_24px_rgba(239,68,68,0.1)]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your creative project..."
                className="h-40 w-full resize-y rounded-xl bg-transparent px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 sm:h-44"
              />
              <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                <span className="h-1 w-1 rounded-full bg-cyan-400/70" /> Prompt channel
              </div>
            </div>

            <button
              onClick={handleGenerateCreativeProject}
              className="group/button relative mt-5 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] transition-all duration-300 hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="m10 2 1.7 5.3L17 9l-5.3 1.7L10 16l-1.7-5.3L3 9l5.3-1.7L10 2Z"/><path d="m15.5 14 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></svg>
              Generate Creative Project
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>
            </button>
          </section>

          <section className="relative mt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />Six systems online</div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Creative AI Modules</h2>
                <p className="mt-1 text-sm text-slate-500">Select a specialized creative system to continue.</p>
              </div>
              <span className="rounded-full border border-red-500/20 bg-red-500/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-red-300">Module network / 06</span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Link
                href="/dashboard/logo-ai"
                onClick={() => {
                  if (prompt.trim()) {
                    localStorage.setItem("easy-platform-logo-prompt", prompt);
                  }
                }}
                className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
              >
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" />
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z"/><circle cx="12" cy="12" r="3"/><path d="M12 9V3M15 13.5l6 2.5M9 13.5 3 16"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-01</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Logo Concept AI</h3>
                <p className="relative mt-2 text-sm leading-6 text-slate-400">Create a complete logo direction with symbol ideas, color palette, typography and brand meaning.</p>
                <div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>

              <Link href="/dashboard/image-ai" className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" /><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-02</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Image AI</h3><p className="relative mt-2 text-sm leading-6 text-slate-400">Create marketing images, ads, posters and graphics.</p><div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>

              <Link href="/dashboard/presentation-ai" onClick={() => { if (prompt.trim()) { localStorage.setItem("easy-platform-presentation-prompt", prompt); } }} className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" /><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M4 4h16v12H4zM8 20l4-4 4 4"/><path d="M8 12V9m4 3V7m4 5v-2"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-03</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Presentation AI</h3><p className="relative mt-2 text-sm leading-6 text-slate-400">Build professional presentations automatically.</p><div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>

              <Link href="/dashboard/content-ai" className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" /><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h6"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-04</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Content AI</h3><p className="relative mt-2 text-sm leading-6 text-slate-400">Generate blogs, emails, website copy and social posts.</p><div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>

              <Link href="/dashboard/video-ai" onClick={() => { if (prompt.trim()) { localStorage.setItem("easy-platform-video-prompt", prompt); } }} className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" /><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2zM9 9l4 3-4 3z"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-05</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Video AI</h3><p className="relative mt-2 text-sm leading-6 text-slate-400">Create scripts, storyboards and AI video concepts.</p><div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>

              <Link href="/dashboard/automation" onClick={() => { if (prompt.trim()) { localStorage.setItem("easy-platform-social-prompt", prompt); } }} className="group relative min-h-56 overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_35px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/70 to-transparent opacity-40 transition-opacity group-hover:opacity-100" /><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl transition-colors group-hover:bg-red-500/20" />
                <div className="relative flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/25 bg-slate-950/80 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.08)] transition-all group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.18)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="m6.7 8 2.7 2M17.3 8l-2.7 2M6.7 16l2.7-2M17.3 16l-2.7-2"/></svg></div><span className="font-mono text-[9px] tracking-[0.2em] text-slate-600">CR-06</span></div>
                <h3 className="relative mt-5 text-lg font-semibold text-white">Social Automation</h3><p className="relative mt-2 text-sm leading-6 text-slate-400">Schedule and automate social media publishing.</p><div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />System active</div>
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default function CreativeAIPage() {
  return <Suspense fallback={null}><CreativeAIPageContent /></Suspense>;
}
