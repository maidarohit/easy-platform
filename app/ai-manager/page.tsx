"use client";

import { Suspense, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import { useProjectMemory } from "../hooks/useProjectMemory";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import type { AiManagerJobStatus, AiManagerOutput, AiManagerStrategy } from "../lib/ai/types";

const industryOptions = [
  "Digital Marketing",
  "Interior Design",
  "Architecture",
  "E-commerce",
  "Restaurant",
  "Real Estate",
  "Healthcare",
  "Education",
  "Finance",
  "Technology",
  "Other",
];

const goalOptions = [
  "Increase Sales",
  "Generate More Leads",
  "Improve Brand Awareness",
  "Launch New Product",
  "Improve Customer Support",
  "Scale Business",
  "Automate Operations",
];

function AIManagerPageContent() {
  const { project, projectId: requestedProjectId } = useProjectMemory();
  const [companyName, setCompanyName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [result, setResult] = useState<AiManagerStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState("overview");
  const [analyticsContext, setAnalyticsContext] = useState<unknown>(null);
  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      setJobId("");
      setLoading(false);
      setError("");
    });

    return () => {
      active = false;
    };
  }, [requestedProjectId]);

  useEffect(() => {
    if (!project) return;

    queueMicrotask(() => {
        if (project.id !== requestedProjectId) return;
        setProjectId(project.id);
        setCompanyName(project.companyName);
        setBusinessDescription(project.businessDescription);
        setIndustry(project.industry);
        setBusinessGoal(project.goal);
        setAnalyticsContext(null);
        if (project.result) {
  try {
    setResult(JSON.parse(project.result) as AiManagerStrategy);
  } catch {
    setResult(null);
  }
} else {
  setResult(null);
}
    });
  }, [project, requestedProjectId]);

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const pollJob = async () => {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error("Please sign in to check the AI Manager job.");
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(
          `/api/ai-manager/jobs/${encodeURIComponent(jobId)}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        const data = await response.json() as {
          status?: AiManagerJobStatus;
          result?: AiManagerOutput;
          error?: string;
        };

        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Failed to check AI Manager job.");

        if (data.status === "completed" && data.result) {
  const completedResult = data.result.output;

  setResult(completedResult);

  if (project) {
    try {
      const saveResponse = await authenticatedFetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: project.id,
          userId: project.userId,
          name: project.name,
          result: JSON.stringify(completedResult),
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveData.error || "Failed to save AI Manager result"
        );
      }
    } catch (saveError) {
      console.error("Failed to save AI Manager result:", saveError);
    }
  }

  setLoading(false);
  setJobId("");
  return;
}

        if (data.status === "failed") {
          setError(data.error || "AI Manager job failed.");
          setLoading(false);
          setJobId("");
          return;
        }

        pollTimer = setTimeout(pollJob, 3_000);
      } catch (pollError) {
        if (!active) return;
        console.error("AI Manager polling error:", pollError);
        pollTimer = setTimeout(pollJob, 3_000);
      }
    };

    void pollJob();

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [jobId, project]);

  const handleGenerate = async () => {
    
  if (loading) return;

  setLoading(true);
  setError("");

  console.log("Button Clicked");

  try {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("Please sign in to generate a business strategy.");
    }

    if (!projectId) {
      throw new Error("Please open a project before generating a business strategy.");
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/ai-manager", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
  projectId,
  companyName,
  businessDescription,
  industry,
  businessGoal,
  analyticsContext,
}),
    });

    const data = await response.json() as {
      jobId?: string;
      status?: AiManagerJobStatus;
      error?: string;
    };

console.log("Received:", data);

if (!response.ok || !data.jobId) {
  throw new Error(data.error || "Failed to start AI Manager job.");
}

setResult(null);
setJobId(data.jobId);

console.log("Finished");
  } catch (error) {
    console.error(error);
    setError(error instanceof Error ? error.message : "Failed to start AI Manager job.");
    setLoading(false);
  }
};
const continueToCreativeAI = () => {
  if (!strategy) return;

  localStorage.setItem(
    "easy-platform-open-creative-project",
    JSON.stringify({
      companyName,
      businessDescription,
      industry,
      businessGoal,
      strategy,
    })
  );

  window.location.assign(
    projectId
      ? `/dashboard/creative-ai?projectId=${encodeURIComponent(projectId)}`
      : "/dashboard/creative-ai",
  );
};
const copyStrategy = async () => {
  if (!result) return;

  await navigator.clipboard.writeText(
    JSON.stringify(result, null, 2)
  );

  alert("✅ Strategy copied!");
};
const strategy = result;
const downloadPDF = () => {
  if (!strategy) return;

  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.text("AI Business Strategy", 20, 20);

  doc.setFontSize(14);

  let y = 35;

  const sections = [
    ["Business Overview", strategy.overview],
    ["Branding Strategy", strategy.branding],
    ["Website Strategy", strategy.website],
    ["Marketing Strategy", strategy.marketing],
    ["SEO Strategy", strategy.seo],
    ["UI/UX Strategy", strategy.uiux],
    ["Sales Strategy", strategy.sales],
    ["Analytics Strategy", strategy.analytics],
  ];

  sections.forEach(([title, content]) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, y);
    y += 8;

    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(String(content), 170);
    doc.text(lines, 20, y);

    y += lines.length * 7 + 10;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("AI-Business-Strategy.pdf");
};

  return (
    <main className="flex min-h-screen bg-slate-950">
      <Sidebar />

      <section className="flex-1">
        <Navbar />

        <div className="max-w-6xl mx-auto p-10">
          <div className="mb-10 flex items-start justify-between gap-6">
  <div className="flex items-start gap-5">
    {/* AI MANAGER ICON */}
    <div
      className="
        relative flex h-16 w-16 shrink-0 items-center justify-center
        overflow-hidden rounded-2xl
        border border-red-500/30
        bg-gradient-to-br from-red-500/15 to-slate-950
        shadow-[0_0_32px_rgba(239,68,68,0.16)]
      "
    >
      <div
        className="
          absolute inset-0
          bg-gradient-to-br
          from-red-500/10 via-transparent to-cyan-400/10
        "
      />

      <span className="relative text-2xl text-red-300">
        ✦
      </span>

      <span
        className="
          absolute bottom-2 right-2
          h-1.5 w-1.5 rounded-full
          bg-cyan-400
          shadow-[0_0_8px_rgba(34,211,238,0.9)]
        "
      />
    </div>

    {/* TITLE */}
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="
            h-1.5 w-1.5 rounded-full
            bg-red-500
            shadow-[0_0_8px_rgba(239,68,68,0.9)]
          "
        />

        <span
          className="
            text-[10px] font-semibold uppercase
            tracking-[0.28em] text-red-300
          "
        >
          Business Intelligence Orchestrator
        </span>
      </div>

      <h1 className="text-5xl font-bold tracking-tight text-white">
        AI Manager
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Coordinate your AI specialists from one intelligence layer and
        generate a complete business strategy from a single business context.
      </p>
    </div>
  </div>

  {/* STATUS */}
  <div
    className="
      mt-2 hidden items-center gap-2
      rounded-full border border-cyan-400/20
      bg-cyan-400/5 px-4 py-2
      md:flex
    "
  >
    <span
      className="
        h-2 w-2 rounded-full
        bg-cyan-400
        shadow-[0_0_9px_rgba(34,211,238,0.95)]
      "
    />

    <span
      className="
        text-[9px] font-semibold uppercase
        tracking-[0.18em] text-cyan-300
      "
    >
      Orchestrator Online
    </span>
  </div>
</div>
<div
  className="
    relative mt-10 overflow-hidden rounded-[28px]
    border border-red-500/15
    bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20
    p-8
    shadow-[0_0_40px_rgba(239,68,68,0.05)]
  "
>
  {/* TOP ENERGY LINE */}
  <div
    className="
      absolute left-0 top-0 h-[2px] w-full
      bg-gradient-to-r
      from-transparent via-red-500/70 to-transparent
    "
  />

  {/* BACKGROUND GLOWS */}
  <div
    className="
      pointer-events-none absolute -right-24 -top-24
      h-56 w-56 rounded-full
      bg-red-500/10 blur-3xl
    "
  />

  <div
    className="
      pointer-events-none absolute -bottom-24 -left-20
      h-52 w-52 rounded-full
      bg-cyan-400/5 blur-3xl
    "
  />

  {/* FORM STATUS */}
  <div className="relative mb-8 flex items-center justify-between">
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span
          className="
            h-1.5 w-1.5 rounded-full
            bg-red-500
            shadow-[0_0_8px_rgba(239,68,68,0.9)]
          "
        />

        <span
          className="
            text-[9px] font-semibold uppercase
            tracking-[0.24em] text-red-300
          "
        >
          Strategy Input Matrix
        </span>
      </div>

      <p className="text-sm text-slate-400">
        Define the business context AI Manager should coordinate.
      </p>
    </div>

    <div
      className="
        flex items-center gap-2 rounded-full
        border border-cyan-400/20
        bg-cyan-400/5
        px-3 py-1.5
      "
    >
      <span
        className="
          h-1.5 w-1.5 rounded-full
          bg-cyan-400
          shadow-[0_0_8px_rgba(34,211,238,0.9)]
        "
      />

      <span
        className="
          text-[9px] font-semibold uppercase
          tracking-[0.16em] text-cyan-300
        "
      >
        {projectId ? "Project Memory Connected" : "New Strategy Session"}
      </span>
    </div>
  </div>

  {/* COMPANY NAME */}
  <div className="relative mb-6">
    <div className="mb-2 flex items-center justify-between">
      <label
        className="
          text-xs font-semibold uppercase
          tracking-[0.16em] text-slate-300
        "
      >
        Company Name
      </label>

      <span className="text-[9px] uppercase tracking-[0.15em] text-red-300">
        Identity
      </span>
    </div>

    <div className="group relative">
      <div
        className="
          pointer-events-none absolute left-4 top-1/2
          flex h-7 w-7 -translate-y-1/2
          items-center justify-center
          rounded-lg border border-red-500/20
          bg-red-500/5
          text-xs text-red-300
        "
      >
        ◈
      </div>

      <input
        type="text"
        placeholder="Example: Buzypeezy"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        className="
          w-full rounded-xl
          border border-slate-700/80
          bg-slate-950/60
          py-3.5 pl-14 pr-4
          text-sm text-white
          outline-none
          transition-all duration-300
          placeholder:text-slate-600
          hover:border-slate-600
          focus:border-red-500/50
          focus:bg-slate-950/90
          focus:shadow-[0_0_22px_rgba(239,68,68,0.10)]
        "
      />
    </div>
  </div>

  {/* BUSINESS DESCRIPTION */}
  <div className="relative mb-6">
    <div className="mb-2 flex items-center justify-between">
      <label
        className="
          text-xs font-semibold uppercase
          tracking-[0.16em] text-slate-300
        "
      >
        Business Description
      </label>

      <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-300">
        Context
      </span>
    </div>

    <textarea
      placeholder="Describe your business, products, services and goals..."
      rows={5}
      value={businessDescription}
      onChange={(e) => setBusinessDescription(e.target.value)}
      className="
        w-full resize-none rounded-xl
        border border-slate-700/80
        bg-slate-950/60
        px-4 py-4
        text-sm leading-6 text-white
        outline-none
        transition-all duration-300
        placeholder:text-slate-600
        hover:border-slate-600
        focus:border-red-500/50
        focus:bg-slate-950/90
        focus:shadow-[0_0_22px_rgba(239,68,68,0.10)]
      "
    />
  </div>

  {/* TWO COLUMN INTELLIGENCE GRID */}
  <div className="relative grid gap-5 md:grid-cols-2">
    {/* INDUSTRY */}
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label
          className="
            text-xs font-semibold uppercase
            tracking-[0.16em] text-slate-300
          "
        >
          Industry
        </label>

        <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-300">
          Sector
        </span>
      </div>

      <select
        value={industry}
        onChange={async (e) => {
  const nextIndustry = e.target.value;
  setIndustry(nextIndustry);

  if (!project) return;

  try {
    const response = await authenticatedFetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: project.id,
        userId: project.userId,
        name: project.name,
        industry: nextIndustry,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save industry");
    }
  } catch (error) {
    console.error("Failed to save industry:", error);
  }
}}
        className="
          w-full cursor-pointer rounded-xl
          border border-slate-700/80
          bg-slate-950/60
          px-4 py-3.5
          text-sm text-white
          outline-none
          transition-all duration-300
          hover:border-slate-600
          focus:border-cyan-400/40
          focus:bg-slate-950/90
          focus:shadow-[0_0_22px_rgba(34,211,238,0.08)]
        "
      >
        <option value="">Select industry</option>
        {industry && !industryOptions.includes(industry) && <option value={industry}>{industry}</option>}
        {industryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>

    {/* BUSINESS GOAL */}
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label
          className="
            text-xs font-semibold uppercase
            tracking-[0.16em] text-slate-300
          "
        >
          Business Goal
        </label>

        <span className="text-[9px] uppercase tracking-[0.15em] text-red-300">
          Objective
        </span>
      </div>

      <select
        value={businessGoal}
        onChange={(e) => setBusinessGoal(e.target.value)}
        className="
          w-full cursor-pointer rounded-xl
          border border-slate-700/80
          bg-slate-950/60
          px-4 py-3.5
          text-sm text-white
          outline-none
          transition-all duration-300
          hover:border-slate-600
          focus:border-red-500/50
          focus:bg-slate-950/90
          focus:shadow-[0_0_22px_rgba(239,68,68,0.10)]
        "
      >
        <option value="">Select business goal</option>
        {businessGoal && !goalOptions.includes(businessGoal) && <option value={businessGoal}>{businessGoal}</option>}
        {goalOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  </div>
<div className="mt-8">
  <button
    onClick={handleGenerate}
    disabled={loading}
    className="
      group relative flex w-full items-center justify-between
      overflow-hidden rounded-2xl
      border border-red-500/30
      bg-gradient-to-r
      from-red-500/20 via-red-500/10 to-cyan-400/10
      px-6 py-4
      font-semibold text-white
      transition-all duration-300
      hover:border-red-400/60
      hover:shadow-[0_0_35px_rgba(239,68,68,0.20)]
      disabled:cursor-not-allowed
      disabled:opacity-60
    "
  >
    {/* RED BACKGROUND GLOW */}
    <span
      className="
        pointer-events-none absolute -left-16 top-1/2
        h-24 w-24 -translate-y-1/2
        rounded-full bg-red-500/20 blur-3xl
        transition-all duration-500
        group-hover:bg-red-500/30
      "
    />

    {/* CYAN BACKGROUND GLOW */}
    <span
      className="
        pointer-events-none absolute -right-12 top-1/2
        h-20 w-20 -translate-y-1/2
        rounded-full bg-cyan-400/10 blur-3xl
      "
    />

    <span className="relative flex items-center gap-4">
      <span
        className="
          flex h-10 w-10 items-center justify-center
          rounded-xl
          border border-red-500/30
          bg-red-500/10
          text-red-300
          shadow-[0_0_18px_rgba(239,68,68,0.15)]
        "
      >
        {loading ? "◌" : "✦"}
      </span>

      <span className="text-left">
        <span
          className="
            block text-[9px] font-semibold uppercase
            tracking-[0.22em] text-red-300
          "
        >
          AI Orchestration
        </span>

        <span className="mt-0.5 block text-sm font-semibold text-white">
          {loading
            ? "Generating Business Intelligence..."
            : "Generate Business Strategy"}
        </span>
      </span>
    </span>

    <span
      className="
        relative flex h-9 w-9 items-center justify-center
        rounded-full
        border border-cyan-400/25
        bg-cyan-400/5
        text-cyan-300
        transition-all duration-300
        group-hover:bg-cyan-400/10
        group-hover:shadow-[0_0_16px_rgba(34,211,238,0.15)]
      "
    >
      →
    </span>
  </button>

  <div className="mt-3 flex items-center justify-center gap-2">
    <span
      className="
        h-1.5 w-1.5 rounded-full
        bg-cyan-400
        shadow-[0_0_8px_rgba(34,211,238,0.9)]
      "
    />

    <span
      className="
        text-[9px] font-medium uppercase
        tracking-[0.18em] text-slate-500
      "
    >
      AI Manager Systems Ready
    </span>
  </div>
  {error && <p className="mt-3 text-center text-xs text-red-300">{error}</p>}
</div>
{result && (
  <div
  className="
    relative mt-8 overflow-hidden rounded-[30px]
    border border-red-500/20
    bg-[#070a11]/95 p-5 sm:p-7
    shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_45px_rgba(239,68,68,0.08)]
  "
>
    <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_16px_rgba(239,68,68,0.45)]" />
    <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-28 -left-24 h-56 w-56 rounded-full bg-cyan-400/[0.04] blur-3xl" />
    {/* RESULT HEADER */}
<div className="relative mb-7 flex flex-wrap items-center justify-between gap-6 border-b border-red-500/10 pb-7">
  <div className="flex items-center gap-4">
    <div
      className="
        relative flex h-14 w-14 items-center justify-center
        rounded-2xl border border-red-400/35
        bg-gradient-to-br from-red-500/15 to-transparent
        text-red-300
        shadow-[inset_0_0_18px_rgba(239,68,68,0.08),0_0_24px_rgba(239,68,68,0.12)]
      "
    >
      <span className="absolute inset-2 rotate-45 rounded-[5px] border border-red-400/45" />
      <span className="h-2 w-2 rotate-45 border border-cyan-300 bg-cyan-300/20 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
    </div>

    <div>
      <div className="mb-1 flex items-center gap-2">
        <span
          className="
            h-1.5 w-1.5 rounded-full
            bg-cyan-400
            shadow-[0_0_8px_rgba(34,211,238,0.9)]
          "
        />

        <span
          className="
            text-[9px] font-semibold uppercase
            tracking-[0.22em] text-cyan-300
          "
        >
          Intelligence Output / Ready
        </span>
      </div>

      <h2 className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-[28px]">
        Business Strategy
      </h2>

      <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400">
        Unified strategy generated by the Buzypeezy AI orchestration layer.
      </p>
    </div>
  </div>

  {/* ACTIONS */}
  <div className="flex flex-wrap items-center gap-2.5">
    <button
      onClick={copyStrategy}
      className="
        flex min-h-10 items-center gap-2 rounded-xl
        border border-cyan-400/20 bg-slate-950/70
        px-4 py-2.5 text-xs font-semibold text-cyan-100
        transition-all duration-300
        hover:-translate-y-0.5 hover:border-cyan-400/45
        hover:bg-cyan-400/[0.08]
        hover:shadow-[0_0_20px_rgba(34,211,238,0.13)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50
      "
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>
      Copy
    </button>

    <button
      onClick={downloadPDF}
      className="
        flex min-h-10 items-center gap-2 rounded-xl
        border border-red-500/25 bg-slate-950/70
        px-4 py-2.5 text-xs font-semibold text-red-100
        transition-all duration-300
        hover:-translate-y-0.5 hover:border-red-400/50
        hover:bg-red-500/10
        hover:shadow-[0_0_20px_rgba(239,68,68,0.14)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50
      "
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>
      Download PDF
    </button>

    <button
      onClick={continueToCreativeAI}
      className="
        group flex min-h-10 items-center gap-3 rounded-xl
        border border-red-400/40
        bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10
        px-4 py-2.5 text-xs font-semibold text-white
        transition-all duration-300
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(239,68,68,0.08)]
        hover:-translate-y-0.5 hover:border-red-300/60
        hover:shadow-[0_0_26px_rgba(239,68,68,0.2)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60
      "
    >
      Continue to Creative AI

      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>
    </button>
  </div>
</div>

    <div className="relative space-y-3">
  {[
    {
      id: "overview",
      icon: "01",
      title: "Business Overview",
      value: strategy?.overview,
    },
    {
      id: "branding",
      icon: "02",
      title: "Branding Strategy",
      value: strategy?.branding,
    },
    {
      id: "website",
      icon: "03",
      title: "Website Strategy",
      value: strategy?.website,
    },
    {
      id: "marketing",
      icon: "04",
      title: "Marketing Strategy",
      value: strategy?.marketing,
    },
    {
      id: "seo",
      icon: "05",
      title: "SEO Strategy",
      value: strategy?.seo,
    },
    {
      id: "uiux",
      icon: "06",
      title: "UI/UX Strategy",
      value: strategy?.uiux,
    },
    {
      id: "sales",
      icon: "07",
      title: "Sales Strategy",
      value: strategy?.sales,
    },
    {
      id: "analytics",
      icon: "08",
      title: "Analytics Strategy",
      value: strategy?.analytics,
    },
  ].map((section) => {
    const isOpen = openSection === section.id;

    return (
      <div
        key={section.id}
        className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/95 via-[#0b0f18]/95 to-red-950/10 transition-all duration-300 before:pointer-events-none before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent before:transition-opacity before:duration-300 ${isOpen ? "border-red-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),inset_0_0_28px_rgba(239,68,68,0.04),0_0_28px_rgba(239,68,68,0.11)] before:opacity-100" : "border-white/[0.07] before:opacity-25 hover:-translate-y-0.5 hover:border-red-400/30 hover:shadow-[0_12px_30px_rgba(0,0,0,0.24),0_0_20px_rgba(239,68,68,0.06)] hover:before:opacity-80"}`}
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() =>
            setOpenSection(isOpen ? "" : section.id)
          }
          className={`relative flex w-full items-center justify-between gap-4 px-4 py-[18px] text-left transition-colors duration-300 sm:px-5 ${isOpen ? "bg-red-500/[0.025]" : "hover:bg-white/[0.015]"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/40`}
        >
          <div className="flex min-w-0 items-center gap-4">
            <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-slate-950/75 font-mono text-[10px] font-bold tracking-[0.2em] transition-all duration-300 ${isOpen ? "border-red-400/50 text-red-200 shadow-[inset_0_0_14px_rgba(239,68,68,0.08),0_0_18px_rgba(239,68,68,0.14)]" : "border-red-500/15 text-slate-500 group-hover:border-red-400/35 group-hover:text-red-300 group-hover:shadow-[0_0_18px_rgba(239,68,68,0.1)]"}`}>
              <span className="absolute left-1.5 top-1.5 h-1 w-1 border-l border-t border-cyan-300/70" />
              {section.icon}
            </span>

            <span>
              <span className="mb-1.5 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                <span className={`h-1 w-1 rounded-full ${isOpen ? "bg-cyan-300 shadow-[0_0_7px_rgba(34,211,238,1)]" : "bg-cyan-400/40"}`} />
                Strategy module
              </span>
              <h3 className={`truncate text-sm font-semibold tracking-[0.01em] transition-colors sm:text-base ${isOpen ? "text-white" : "text-slate-300 group-hover:text-white"}`}>
                {section.title}
              </h3>
            </span>
          </div>

          <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${isOpen ? "rotate-45 border-cyan-300/40 bg-cyan-400/[0.08] text-cyan-200" : "border-white/10 text-slate-500 group-hover:border-cyan-300/30 group-hover:text-cyan-300"}`}>
            <span className="absolute h-px w-3 bg-current" />
            <span className="absolute h-3 w-px bg-current" />
          </span>
        </button>

        {isOpen && (
          <div className="relative border-t border-red-400/15 bg-black/10 px-5 py-5 sm:px-6 sm:py-6">
            <span className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-red-400/60 via-red-400/15 to-transparent" />
            <p className="max-w-none whitespace-pre-wrap text-[13px] font-normal leading-[1.85] tracking-[0.005em] text-slate-300 selection:bg-red-500/30 selection:text-white sm:text-sm">
              {String(section.value ?? "")}
            </p>
          </div>
        )}
      </div>
    );
  })}
</div>
    </div>
)}
</div>

          
        </div>
      </section>
    </main>
  );
}

export default function AIManagerPage() {
  return (
    <Suspense fallback={null}>
      <AIManagerPageContent />
    </Suspense>
  );
}
