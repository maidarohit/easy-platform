"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { EASY_MODE_GOALS, mapExistingGoal, type EasyModeGoalId } from "@/app/lib/easy-mode-goal-options";

type EasyModeProject = {
  id: string;
  companyName?: string | null;
  name: string;
  brandDescription?: string | null;
  originalBrief?: string | null;
  industry?: string | null;
  location?: string | null;
  businessStage?: string | null;
  goal?: string | null;
};

type EasyModeRunView = {
  run: { id: string; status: string };
  tasks: Array<{ id: string; moduleId: string; position: number; status: string }>;
  progress: { total: number; queued: number; completed: number; failed: number };
};

type CustomerProgress = {
  runStatus: "In progress" | "Completed" | "Needs attention";
  tasks: Array<{ label: string; status: "Waiting" | "In progress" | "Completed" | "Needs attention" }>;
};

const taskLabel = (moduleId: string) => moduleId
  .replace("ai-manager", "Business plan")
  .replace("branding-context", "Brand foundation")
  .replace("uiux", "Customer experience")
  .replace(/-/g, " ")
  .replace(/^./, (letter) => letter.toUpperCase());

function EasyModeContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "";
  const [project, setProject] = useState<EasyModeProject | null>(null);
  const [industry, setIndustry] = useState("");
  const [goalId, setGoalId] = useState<EasyModeGoalId>("improve_business");
  const [loading, setLoading] = useState(Boolean(projectId));
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [runView, setRunView] = useState<EasyModeRunView | null>(null);
  const [customerProgress, setCustomerProgress] = useState<CustomerProgress | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState("");
  const [error, setError] = useState(projectId ? "" : "Open a business project to continue.");
  const idempotencyKey = useRef("");

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let active = true;
    async function loadProject() {
      try {
        const response = await authenticatedFetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to open this business.");
        if (!active) return;
        const loadedProject = data.project as EasyModeProject;
        setProject(loadedProject);
        setIndustry(loadedProject.industry?.trim() || "");
        setGoalId(mapExistingGoal(loadedProject.goal));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to open this business.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProject();
    return () => { active = false; };
  }, [projectId]);

  async function handlePreflight() {
    if (!project || submitting) return;
    if (!industry.trim()) {
      setError("Please add your industry before continuing.");
      return;
    }
    setSubmitting(true);
    setError("");
    setReady(false);
    try {
      const response = await authenticatedFetch("/api/easy-mode/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, industry: industry.trim(), goalId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare your business.");
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const runResponse = await authenticatedFetch("/api/easy-mode/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, goalId, idempotencyKey: idempotencyKey.current }),
      });
      const runData = await runResponse.json();
      if (!runResponse.ok) throw new Error(runData.error || "Unable to prepare your business build.");
      setProject((current) => current ? { ...current, industry: industry.trim(), goal: goalId } : current);
      setRunView(runData as EasyModeRunView);
      setCustomerProgress(null);
      setExecutionMessage("");
      setReady(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to prepare your business.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecuteNext() {
    if (!runView || executing) return;
    setExecuting(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/easy-mode/runs/${encodeURIComponent(runView.run.id)}/execute-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json() as { message?: string; progress?: CustomerProgress; error?: string };
      if (data.progress) setCustomerProgress(data.progress);
      setExecutionMessage(data.message || "This step could not be started.");
      if (!response.ok && !data.message) throw new Error(data.error || "Unable to start the next step.");
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Unable to start the next step.");
    } finally {
      setExecuting(false);
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] text-[#606A64]">Opening your business…</main>;

  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-8 text-[#1B211E] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-5 border-b border-[#D8DCCF] pb-5">
          <span className="text-lg font-semibold text-[#173D32]">Buzypeezy</span>
          <Link href="/dashboard" className="text-sm font-semibold text-[#606A64] hover:text-[#173D32]">Back to Dashboard</Link>
        </header>

        <section className="py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Easy Mode</p>
          <h1 className="mt-4 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.055em] text-[#173D32]">Build My Business</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#606A64]">Tell us the essentials once. Buzypeezy will use them to prepare the right next steps for your business.</p>

          {error && <p role="alert" className="mt-7 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {project && (
            <div className="mt-9 rounded-[28px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 shadow-[0_20px_60px_rgba(40,52,45,0.08)] sm:p-9">
              <div className="grid gap-5 sm:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B847E]">Business name</p><p className="mt-2 text-lg font-semibold text-[#173D32]">{project.companyName || project.name}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B847E]">Location</p><p className="mt-2 text-lg text-[#344039]">{project.location || "Not provided"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B847E]">Business stage</p><p className="mt-2 text-lg text-[#344039]">{project.businessStage || "Not provided"}</p></div>
                <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B847E]">What the business does</p><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-[#606A64]">{project.originalBrief || project.brandDescription || "Not provided"}</p></div>
              </div>

              <div className="mt-8 border-t border-[#D8DCCF] pt-7">
                <label className="block max-w-xl text-sm font-semibold text-[#173D32]">Industry <span className="text-red-600">*</span><input value={industry} onChange={(event) => { setIndustry(event.target.value); setReady(false); setRunView(null); idempotencyKey.current = ""; }} maxLength={200} required placeholder="Example: Real Estate" className="mt-2.5 h-14 w-full rounded-[14px] border border-[#D8DCCF] bg-white px-4 text-base font-normal outline-none focus:border-[#A8B8A7] focus:ring-4 focus:ring-[#A8B8A7]/20" /></label>

                <fieldset className="mt-8">
                  <legend className="text-sm font-semibold text-[#173D32]">What would you like to do first?</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {EASY_MODE_GOALS.map((goal) => <button key={goal.id} type="button" aria-pressed={goalId === goal.id} onClick={() => { setGoalId(goal.id); setReady(false); setRunView(null); idempotencyKey.current = ""; }} className={`min-h-20 rounded-[16px] border p-4 text-left text-sm font-semibold transition ${goalId === goal.id ? "border-[#173D32] bg-[#EEE9DC] text-[#173D32]" : "border-[#D8DCCF] bg-white text-[#606A64] hover:border-[#A8B8A7]"}`}>{goal.label}</button>)}
                  </div>
                </fieldset>

                <button type="button" onClick={handlePreflight} disabled={submitting || !industry.trim()} className="mt-8 min-h-14 rounded-[14px] bg-[#173D32] px-7 font-semibold text-white shadow-[0_12px_30px_rgba(23,61,50,0.16)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Getting things ready…" : "Build My Business"}</button>

                {ready && runView && <div className="mt-6 rounded-[18px] border border-[#A8B8A7] bg-[#EDF0E8] p-5"><p className="font-semibold text-[#173D32]">Your business build is ready to start.</p><p className="mt-2 text-sm leading-6 text-[#606A64]">We prepared {runView.progress.total} steps. Start one step at a time and review the progress here.</p><div className="mt-4 space-y-2">{customerProgress ? customerProgress.tasks.map((task) => <div key={task.label} className="flex items-center justify-between rounded-xl border border-[#D8DCCF] bg-white/70 px-4 py-3"><span className="text-sm font-medium text-[#344039]">{task.label}</span><span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A713F]">{task.status}</span></div>) : runView.tasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-xl border border-[#D8DCCF] bg-white/70 px-4 py-3"><span className="text-sm font-medium text-[#344039]">{taskLabel(task.moduleId)}</span><span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A713F]">Waiting</span></div>)}</div>{executionMessage && <p className="mt-4 text-sm font-medium text-[#344039]">{executionMessage}</p>}<button type="button" onClick={handleExecuteNext} disabled={executing || customerProgress?.runStatus === "Completed"} className="mt-5 min-h-12 rounded-[14px] bg-[#173D32] px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{executing ? "Starting the next step…" : "Start Building"}</button></div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function EasyModePage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F7F4EC]" />}><EasyModeContent /></Suspense>;
}
