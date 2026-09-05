"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type BuildView = {
  run: { id: string; status: string };
  tasks: Array<{ id: string; moduleId: string; status: string; customerState: string; customerMessage: string | null }>;
  progress: { total: number; queued: number; completed: number; failed: number };
};

const FRIENDLY_PHASES: Readonly<Record<string, string>> = {
  "ai-manager": "Understanding your direction", branding: "Creating your brand",
  website: "Building your online presence", marketing: "Preparing your marketing",
  seo: "Setting up growth foundations", uiux: "Shaping your customer experience",
  sales: "Finalizing your business workspace",
};

function BusinessBuildContent() {
  const projectId = useSearchParams().get("projectId")?.trim() ?? "";
  const [view, setView] = useState<BuildView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const executionStarted = useRef(false);

  const fetchBuild = useCallback(async () => {
    if (!projectId) throw new Error("Open a valid business project.");
    const response = await authenticatedFetch(`/api/business-build?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to restore your business build.");
    if (!data.run) throw new Error("Start your business build from the confirmed Business DNA screen.");
    return data as BuildView;
  }, [projectId]);

  useEffect(() => {
    let active = true;
    void fetchBuild().then((loaded) => {
      if (active) setView(loaded);
      if (!active || executionStarted.current || !["queued", "running"].includes(loaded.run.status)) return;
      executionStarted.current = true;
      void authenticatedFetch(`/api/easy-mode/runs/${encodeURIComponent(loaded.run.id)}/execute-next`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).then(() => fetchBuild()).then((updated) => { if (active) setView(updated); })
        .catch(() => { if (active) setError("Your completed work is safe, but this build needs support."); });
    }).catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to open this build."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchBuild]);

  useEffect(() => {
    if (!view || !["queued", "running"].includes(view.run.status)) return;
    const interval = window.setInterval(() => void fetchBuild().then(setView).catch(() => undefined), 3_000);
    return () => window.clearInterval(interval);
  }, [fetchBuild, view]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#606A64]">Opening your business build…</main>;
  const completed = view?.run.status === "completed";
  const needsAttention = Boolean(view && ["failed", "partially_completed"].includes(view.run.status));
  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-10 text-[#1B211E] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Build My Business</p>
        <h1 className="mt-4 text-[clamp(2.6rem,7vw,4.8rem)] font-semibold leading-none tracking-[-0.055em] text-[#173D32]">{completed ? "Your workspace is ready." : "Building your business."}</h1>
        <p className="mt-5 text-lg leading-8 text-[#606A64]">Everything runs from your confirmed business understanding. You do not need to start individual tools.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {view && <div className="mt-9 space-y-3">{view.tasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#D8DCCF] bg-[#FCFBF7] p-5"><span className="font-semibold text-[#173D32]">{FRIENDLY_PHASES[task.moduleId] ?? "Preparing your business"}</span><span className="text-sm text-[#606A64]">{task.customerState}</span></div>)}</div>}
        {view && !completed && !needsAttention && <p className="mt-6 text-sm font-medium text-[#606A64]">{view.progress.completed} of {view.progress.total} phases complete.</p>}
        {needsAttention && <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-[#173D32]">Your build needs support.</p><p className="mt-2 text-sm leading-6 text-[#606A64]">Completed work is saved. Nothing uncertain will be replayed automatically.</p></div>}
        {completed && <Link href={`/master-workspace?projectId=${encodeURIComponent(projectId)}`} className="mt-8 inline-flex min-h-13 items-center rounded-[14px] bg-[#173D32] px-7 font-semibold text-white">Open Business Workspace</Link>}
      </div>
    </main>
  );
}

export default function BusinessBuildPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F7F4EC]" />}><BusinessBuildContent /></Suspense>;
}
