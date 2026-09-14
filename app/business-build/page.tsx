"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { findEasyModeAttentionStage, mapEasyModeTasksToCustomerStages } from "@/app/lib/easy-mode-customer-progress-stages";

type BuildView = {
  run: { id: string; status: string };
  tasks: Array<{
    id: string;
    moduleId: string;
    status: string;
    customerState: "Waiting" | "In progress" | "Completed" | "Failed" | "Needs attention" | "Not needed";
    customerMessage: string | null;
    canRetry: boolean;
  }>;
  progress: { total: number; queued: number; completed: number; failed: number };
};

function BusinessBuildContent() {
  const projectId = useSearchParams().get("projectId")?.trim() ?? "";
  const [view, setView] = useState<BuildView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

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
    void fetchBuild().then((loaded) => { if (active) setView(loaded); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to open this build."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchBuild]);

  useEffect(() => {
    if (!view?.run.id || !["queued", "running"].includes(view.run.status)) return;
    const runId = view.run.id;
    let active = true;
    let requestInFlight = false;

    async function refreshRun() {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const loaded = await fetchBuild();
        if (!active) return;
        setView(loaded);
        if (["queued", "running"].includes(loaded.run.status)) {
          await authenticatedFetch(`/api/easy-mode/runs/${encodeURIComponent(runId)}/execute-next`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const updated = await fetchBuild();
          if (active) setView(updated);
        }
      } catch {
        if (active) setError("Your completed work is safe, but this build needs support.");
      } finally {
        requestInFlight = false;
      }
    }

    void refreshRun();
    const intervalId = window.setInterval(() => void refreshRun(), 3_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [fetchBuild, view?.run.id, view?.run.status]);

  const retryTask = view?.tasks.find((task) => task.canRetry);
  const customerStages = view ? mapEasyModeTasksToCustomerStages(view.tasks) : [];
  const attentionStage = findEasyModeAttentionStage(customerStages);
  const retryFailedPhase = async () => {
    if (!view || !retryTask || retrying) return;
    setRetrying(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/easy-mode/runs/${encodeURIComponent(view.run.id)}/tasks/${encodeURIComponent(retryTask.id)}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Unable to retry the failed phase.");
      setView(await fetchBuild());
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Unable to retry the failed phase.");
      try { setView(await fetchBuild()); } catch {}
    } finally { setRetrying(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#606A64]">Opening your business build...</main>;
  const completed = view?.run.status === "completed";
  const needsAttention = Boolean(view && ["failed", "partially_completed"].includes(view.run.status));
  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-10 text-[#1B211E] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Build My Business</p>
        <h1 className="mt-4 text-[clamp(2.6rem,7vw,4.8rem)] font-semibold leading-none tracking-[-0.055em] text-[#173D32]">{completed ? "Your workspace is ready." : "Building your business."}</h1>
        <p className="mt-5 text-lg leading-8 text-[#606A64]">Everything runs from your confirmed business understanding. You do not need to start individual tools.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {view && (
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {customerStages.map((stage, index) => <div key={stage.id} className={`rounded-[24px] border p-5 shadow-[0_16px_40px_rgba(40,52,45,0.06)] ${stage.status === "Completed" ? "border-[#A8B8A7] bg-[#FCFBF7]" : stage.status === "In progress" ? "border-[#173D32] bg-[#F4F7F2]" : stage.status === "Failed" || stage.status === "Needs attention" ? "border-amber-300 bg-amber-50" : "border-[#D8DCCF] bg-white"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Step {index + 1}</span>
                <span className="rounded-full bg-[#E7ECE4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#173D32]">{stage.badge}</span>
              </div>
              <p className="mt-4 text-xl font-semibold text-[#173D32]">{stage.title}</p>
              <p className="mt-4 text-sm font-medium text-[#344039]">{stage.status}</p>
              {stage.message && <p className="mt-3 text-sm leading-6 text-[#606A64]">{stage.message}</p>}
            </div>)}
          </div>
        )}
        {view && !completed && !needsAttention && <p className="mt-6 text-sm font-medium text-[#606A64]">Understanding, Building, and Ready will update here automatically as your business workspace comes together.</p>}
        {needsAttention && <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-[#173D32]">Your build needs support.</p><p className="mt-2 text-sm leading-6 text-[#606A64]">{attentionStage ? `${attentionStage.title} needs attention.` : "Completed work is saved. Nothing uncertain will be replayed automatically."} {attentionStage?.message || "Completed work is saved. Nothing uncertain will be replayed automatically."}</p>{retryTask && <button type="button" disabled={retrying} onClick={() => void retryFailedPhase()} className="mt-4 inline-flex min-h-12 items-center rounded-[14px] bg-[#173D32] px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{retrying ? "Retrying failed phase..." : "Retry failed phase"}</button>}</div>}
        {completed && <Link href={`/master-workspace?projectId=${encodeURIComponent(projectId)}`} className="mt-8 inline-flex min-h-13 items-center rounded-[14px] bg-[#173D32] px-7 font-semibold text-white">Open Business Workspace</Link>}
      </div>
    </main>
  );
}

export default function BusinessBuildPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F7F4EC]" />}><BusinessBuildContent /></Suspense>;
}
