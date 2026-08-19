"use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { useProjectMemory } from "../hooks/useProjectMemory";

const SalesIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <path d="M4 18V9m5 9V5m5 13v-7m5 7V3M3 20h18" />
    <path d="m4 7 5-4 5 6 5-7" />
  </svg>
);

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
    <rect x="7" y="7" width="9" height="9" rx="1.5" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-7A1.5 1.5 0 0 0 3 5.5v7A1.5 1.5 0 0 0 4.5 14H7" />
  </svg>
);

function SalesAIPageContent() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [salesGoal, setSalesGoal] = useState("Increase Revenue");
  const [businessDescription, setBusinessDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [salesResult, setSalesResult] = useState<Record<string, string> | null>(null);
  const { project, projectId } = useProjectMemory();

  useEffect(() => {
  if (!projectId) return;

  // Clear data/results from the previously opened project.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setSalesResult(null);
setCompanyName("");
setIndustry("");
setTargetAudience("");
setSalesGoal("Increase Revenue");
setBusinessDescription("");

  // Wait for this exact project to load from Project Memory.
  if (!project || project.id !== projectId) return;

  setCompanyName(project.companyName || "");
  setIndustry(project.industry || "");
  setTargetAudience(project.targetAudience || "");
  setBusinessDescription(
    project.businessDescription || project.originalBrief || ""
  );
}, [projectId, project]);
useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedSalesOutput = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=sales`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Sales AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setSalesResult(savedResult);
    } catch (error) {
      console.error("Failed to restore Sales AI output:", error);
    }
  };

  loadSavedSalesOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.userId]);

  const handleGenerate = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast.error("Please log in first.");
      return;
    }

    if (!projectId) {
      toast.error("Please open a project before generating Sales intelligence.");
      return;
    }

    try {
      setLoading(true);
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/sales-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          companyName,
          industry,
          salesGoal,
          targetAudience,
          businessDescription,
          projectId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
  throw new Error(
    data?.error || `Sales AI request failed with status ${response.status}`
  );
}
      console.log("Sales AI Response:", data);
      console.log(data);
      setSalesResult(data.output ?? data);
      const finalSalesResult = data.output ?? data;

if (projectId && project?.userId && finalSalesResult) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: project.userId,
      module: "sales",
      result: finalSalesResult,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save Sales AI output");
  }
}
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const continueToAnalytics = () => {
  if (!salesResult) {
    toast.error("Generate the Sales Strategy first.");
    return;
  }

  if (!projectId) {
    toast.error("Project context is missing.");
    return;
  }

  window.location.href =
    `/analytics-ai?projectId=${encodeURIComponent(projectId)}`;
};

  const downloadPDF = () => {
    if (!salesResult) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Sales AI Report", 20, 20);
    doc.setFontSize(12);
    let y = 35;
    Object.entries(salesResult).forEach(([key, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(key, 20, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(String(value), 170);
      doc.text(lines, 20, y);
      y += lines.length * 7 + 8;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save("Sales-AI-Report.pdf");
    toast.success("PDF Downloaded!");
  };

  const copyText = (value: unknown, label: string) => {
    navigator.clipboard.writeText(String(value ?? ""));
    toast.success(`${label} copied!`);
  };

  const copyEntireStrategy = () => {
    if (!salesResult) return;
    navigator.clipboard.writeText(JSON.stringify(salesResult, null, 2));
    toast.success("Copied to Clipboard!");
  };

  const resetStrategy = () => {
    setCompanyName("");
    setIndustry("");
    setTargetAudience("");
    setSalesGoal("Increase Revenue");
    setBusinessDescription("");
    setSalesResult(null);
  };

  const modules = salesResult ? [
    ["01", "Executive Summary", "STRATEGY", salesResult.executiveSummary],
    ["02", "Target Customer Profile", "AUDIENCE", salesResult.targetCustomerProfile],
    ["03", "Sales Funnel", "JOURNEY", salesResult.salesFunnel],
    ["04", "Lead Generation Strategy", "ACQUISITION", salesResult.leadGenerationStrategy],
    ["05", "Sales Channels", "CHANNELS", salesResult.salesChannels],
    ["06", "Outreach Strategy", "OUTREACH", salesResult.outreachStrategy],
    ["07", "Pricing Recommendations", "PRICING", salesResult.pricingRecommendations],
    ["08", "Sales KPIs", "MEASUREMENT", salesResult.salesKPIs],
    ["09", "90-Day Action Plan", "EXECUTION", salesResult.actionPlan],
    ["10", "Sales Script", "CONVERSION", salesResult.salesScript],
    ["11", "Proposal Strategy", "PROPOSAL", salesResult.proposal],
    ["12", "Closing Strategy", "CLOSING", salesResult.closingStrategy],
  ] : [];
  const fieldClass = "w-full rounded-xl border border-slate-700/70 bg-[#070b16]/90 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-red-500/30 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10";
  const selectClass = `${fieldClass} appearance-none pr-11`;
  const labelClass = "mb-2 flex items-center justify-between text-sm font-medium text-white";
  const codeClass = "text-[9px] font-semibold tracking-[0.2em] text-cyan-400/70";

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#03050b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(239,68,68,0.08),transparent_28%),radial-gradient(circle_at_90%_34%,rgba(34,211,238,0.05),transparent_24%)]" />
      <Sidebar />
      <section className="relative z-10 min-w-0 flex-1">
        <Navbar />
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.14)]"><div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-cyan-400/10" /><SalesIcon className="relative h-7 w-7" /><span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" /></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300">Sales Intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Sales Intelligence</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">Engineer complete revenue systems, lead conversion strategies, sales processes, objection handling and scalable closing frameworks through one intelligent sales engine.</p></div>
            </div>
            <button onClick={resetStrategy} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>New Sales Strategy</button>
          </header>

          <section className="relative mt-10 overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 shadow-[0_0_60px_rgba(239,68,68,0.07)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-red-300">Sales Generation Matrix</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Configure the revenue brief</h2><p className="mt-2 text-sm leading-6 text-slate-500">Define business context, revenue objective, target market and sales requirements.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_7px_#22d3ee]" />System Ready</span></div>
            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <label><span className={labelClass}><span>Business Name</span><span className={codeClass}>IDENTITY / 01</span></span><input type="text" placeholder="Example: Buzypeezy" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldClass} /></label>
              <label><span className={labelClass}><span>Industry</span><span className={codeClass}>SECTOR / 02</span></span><select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Manufacturing</option><option>Other</option></select></label>
              <label><span className={labelClass}><span>Sales Goal</span><span className={codeClass}>OBJECTIVE / 03</span></span><select value={salesGoal} onChange={(e) => setSalesGoal(e.target.value)} className={selectClass}><option>Increase Revenue</option><option>Generate More Leads</option><option>Increase Conversion Rate</option><option>Improve Customer Retention</option><option>Launch New Product</option><option>Expand to New Markets</option><option>Build Sales Team</option><option>Other</option></select></label>
              <label><span className={labelClass}><span>Target Audience</span><span className={codeClass}>AUDIENCE / 04</span></span><select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={selectClass}><option value="">Select Target Audience</option>{targetAudience && !["Startups", "Small Businesses", "Medium Businesses", "Large Enterprises", "B2B Companies", "B2C Customers", "Entrepreneurs", "E-commerce Businesses", "Healthcare Organizations", "Educational Institutions", "Real Estate Companies", "Other"].includes(targetAudience) && <option value={targetAudience}>{targetAudience}</option>}<option>Startups</option><option>Small Businesses</option><option>Medium Businesses</option><option>Large Enterprises</option><option>B2B Companies</option><option>B2C Customers</option><option>Entrepreneurs</option><option>E-commerce Businesses</option><option>Healthcare Organizations</option><option>Educational Institutions</option><option>Real Estate Companies</option><option>Other</option></select></label>
              <label className="md:col-span-2"><span className={labelClass}><span>Business Description</span><span className={codeClass}>CONTEXT / 05</span></span><textarea rows={5} placeholder="Describe your business, products, services, current sales challenges, and goals..." value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} className={`${fieldClass} resize-y`} /></label>
            </div>
            <button onClick={handleGenerate} disabled={loading} className={`mt-7 flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-sm font-bold uppercase tracking-[0.12em] transition sm:px-7 ${loading ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500" : "border-red-500/40 bg-gradient-to-r from-red-600 via-red-700 to-[#090c15] text-white shadow-[0_0_30px_rgba(239,68,68,0.18)] hover:border-red-400/70 hover:shadow-[0_0_40px_rgba(239,68,68,0.28)]"}`}><span>{loading ? "Generating Sales Intelligence..." : "Generate Sales Intelligence"}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">→</span></button>
          </section>

          {!salesResult ? (
            <section className="mt-8 rounded-[28px] border border-dashed border-red-500/20 bg-slate-950/45 px-6 py-14 text-center sm:px-10"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><SalesIcon /></div><p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Revenue Output / Standby</p><h2 className="mt-3 text-2xl font-semibold">Your Sales Intelligence will appear here</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">Configure the sales brief to generate a complete AI-powered revenue strategy, buyer journey, lead qualification system, objection framework, closing process and scalable growth recommendations.</p></section>
          ) : (
            <section className="mt-8">
              <div className="flex flex-col gap-5 rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Revenue Output / Ready</p><h2 className="mt-2 text-2xl font-semibold">Generated Sales Intelligence</h2></div><div className="flex flex-wrap gap-2"><button onClick={copyEntireStrategy} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10"><CopyIcon />Copy Entire Sales Strategy</button><button onClick={downloadPDF} className="rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/10">Download PDF</button><button onClick={handleGenerate} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-red-500/30 hover:text-white">Regenerate</button><button onClick={continueToAnalytics} className="rounded-xl border border-cyan-400/15 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200">Continue to Analytics AI →</button></div></div>

              <div className="mt-5 rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 sm:p-7"><p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-red-300">Revenue Journey / Active</p><h3 className="mt-2 text-xl font-semibold">Sales Funnel Visual Flow</h3><p className="mt-1 text-sm text-slate-500">A clear path from first contact to closed customer.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{["Awareness", "Lead", "Qualification", "Proposal", "Negotiation", "Close"].map((title, index) => <div key={title} className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center transition hover:border-cyan-400/25"><p className="text-[9px] font-semibold tracking-[0.2em] text-cyan-300">0{index + 1}</p><p className="mt-2 text-sm font-semibold">{title}</p>{index < 5 && <span className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-cyan-500/60 lg:block">→</span>}</div>)}</div></div>

              <div className="mt-5 grid gap-5">{modules.map(([number, title, category, value]) => <article key={String(number)} className="relative overflow-hidden rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_35px_rgba(239,68,68,0.04)] transition hover:border-red-400/30 hover:shadow-[0_0_40px_rgba(239,68,68,0.08)] sm:p-7"><div className="absolute left-0 top-8 h-12 w-px bg-gradient-to-b from-red-400 to-cyan-400" /><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-red-300">Module / {number}</span><span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] font-bold tracking-[0.16em] text-cyan-300">{category}</span></div><h3 className="mt-2 text-xl font-semibold">{title}</h3></div><button onClick={() => copyText(value, String(title))} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"><CopyIcon />Copy</button></div><p className="mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{value}</p></article>)}</div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SalesAIPage() {
  return <Suspense fallback={null}><SalesAIPageContent /></Suspense>;
}
