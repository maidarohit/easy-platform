"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import { useProjectMemory } from "../hooks/useProjectMemory";

const AnalyticsIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <path d="M4 19V9m5 10V5m5 14v-7m5 7V3M3 21h18" /><path d="m4 7 5-4 5 6 5-7" />
  </svg>
);

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><rect x="7" y="7" width="9" height="9" rx="1.5" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-7A1.5 1.5 0 0 0 3 5.5v7A1.5 1.5 0 0 0 4.5 14H7" /></svg>
);

function AnalyticsAIContent() {
  const router = useRouter();
  const { project, projectId } = useProjectMemory();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [monthlyVisitors, setMonthlyVisitors] = useState("");
  const [monthlyLeads, setMonthlyLeads] = useState("");
  const [monthlySales, setMonthlySales] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [marketingBudget, setMarketingBudget] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyticsResult, setAnalyticsResult] = useState<Record<string, any> | null>(null);

  useEffect(() => {
  if (!projectId) return;

  // Clear data from the previously opened project.
  setAnalyticsResult(null);
  setCompanyName("");
  setIndustry("");
  setMonthlyVisitors("");
  setMonthlyLeads("");
  setMonthlySales("");
  setMonthlyRevenue("");
  setMarketingBudget("");
  setBusinessGoal("");
  setBusinessDescription("");

  // Wait for this exact database project.
  if (!project || project.id !== projectId) return;

  setCompanyName(project.companyName || "");
  setIndustry(project.industry || "");
  setBusinessDescription(
    project.businessDescription || project.originalBrief || ""
  );
}, [projectId, project]);

  const continueToAIManager = () => {
    if (!analyticsResult) {
      toast.error("Generate the Analytics Report first.");
      return;
    }
    router.push(
  projectId
    ? `/ai-manager?projectId=${encodeURIComponent(projectId)}`
    : "/ai-manager"
);
  };

  const downloadPDF = () => {
    if (!analyticsResult) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Analytics AI Report", 20, 20);
    doc.setFontSize(12);
    let y = 35;
    Object.entries(analyticsResult).forEach(([key, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(String(key), 20, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(String(value), 170);
      doc.text(lines, 20, y);
      y += lines.length * 7 + 8;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save("Analytics-AI-Report.pdf");
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/analytics-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, industry, monthlyVisitors, monthlyLeads, monthlySales, monthlyRevenue, marketingBudget, businessGoal, businessDescription }),
      });
      const data = await response.json();
      setAnalyticsResult(data.output ?? data);
      toast.success("Analytics Report Generated!");
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toNumber = (value: string) => Number(String(value).replace(/,/g, "")) || 0;
  const visitors = toNumber(monthlyVisitors);
  const leads = toNumber(monthlyLeads);
  const sales = toNumber(monthlySales);
  const revenue = toNumber(monthlyRevenue);
  const budget = toNumber(marketingBudget);
  const leadConversionRate = visitors > 0 ? ((leads / visitors) * 100).toFixed(1) : "0.0";
  const salesConversionRate = leads > 0 ? ((sales / leads) * 100).toFixed(1) : "0.0";
  const averageSaleValue = sales > 0 ? Math.round(revenue / sales) : 0;
  const marketingROI = budget > 0 ? (((revenue - budget) / budget) * 100).toFixed(1) : "0.0";

  const financialScale = Math.max(revenue, budget, 1);
  const revenueScaleWidth = (revenue / financialScale) * 100;
  const budgetScaleWidth = (budget / financialScale) * 100;

  const copyText = (value: unknown, label: string) => {
    navigator.clipboard.writeText(String(value ?? ""));
    toast.success(`${label} copied!`);
  };
  const copyEntireReport = () => {
    if (!analyticsResult) return;
    navigator.clipboard.writeText(JSON.stringify(analyticsResult, null, 2));
    toast.success("Copied to Clipboard!");
  };
  const resetReport = () => {
    setCompanyName(""); setIndustry(""); setMonthlyVisitors(""); setMonthlyLeads("");
    setMonthlySales(""); setMonthlyRevenue(""); setMarketingBudget("");
    setBusinessGoal(""); setBusinessDescription(""); setAnalyticsResult(null);
  };

  const modules = analyticsResult ? [
    ["01", "Executive Summary", "STRATEGY", analyticsResult.executiveSummary],
    ["02", "Business Health Score", "HEALTH", analyticsResult.businessHealthScore],
    ["03", "Traffic Analysis", "TRAFFIC", analyticsResult.trafficAnalysis],
    ["04", "Lead Analysis", "LEADS", analyticsResult.leadAnalysis],
    ["05", "Sales Performance", "SALES", analyticsResult.salesPerformance],
    ["06", "Revenue Analysis", "REVENUE", analyticsResult.revenueAnalysis],
    ["07", "Marketing Performance", "MARKETING", analyticsResult.marketingPerformance],
    ["08", "Conversion Analysis", "CONVERSION", analyticsResult.conversionAnalysis],
    ["09", "Customer Insights", "CUSTOMER", analyticsResult.customerInsights],
    ["10", "Growth Opportunities", "GROWTH", analyticsResult.growthOpportunities],
    ["11", "Key Problems", "RISKS", analyticsResult.keyProblems],
    ["12", "AI Recommendations", "INTELLIGENCE", analyticsResult.aiRecommendations],
    ["13", "90-Day Action Plan", "EXECUTION", analyticsResult.actionPlan90Days],
  ] : [];
  const kpis = [
    ["Website Visitors", visitors.toLocaleString(), "Monthly traffic"],
    ["Leads", leads.toLocaleString(), "Monthly leads"],
    ["Sales", sales.toLocaleString(), "Monthly sales"],
    ["Revenue", `₹${revenue.toLocaleString()}`, "Monthly revenue"],
    ["Lead Conversion Rate", `${leadConversionRate}%`, "Visitor to lead"],
    ["Sales Conversion Rate", `${salesConversionRate}%`, "Lead to sale"],
    ["Average Sale Value", `₹${averageSaleValue.toLocaleString()}`, "Revenue per sale"],
    ["Marketing ROI", `${marketingROI}%`, `₹${budget.toLocaleString()} spend`],
  ];
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
            <div className="flex items-start gap-4"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.14)]"><div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-cyan-400/10" /><AnalyticsIcon className="relative h-7 w-7" /><span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300">Performance Intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Analytics Intelligence</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">Engineer complete performance intelligence, conversion analysis, marketing efficiency, revenue insights and scalable growth recommendations through one intelligent analytics engine.</p></div></div>
            <button onClick={resetReport} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>New Analytics Report</button>
          </header>

          <section className="relative mt-10 overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 shadow-[0_0_60px_rgba(239,68,68,0.07)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-red-300">Analytics Generation Matrix</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Configure the performance brief</h2><p className="mt-2 text-sm leading-6 text-slate-500">Define business context, performance metrics, growth objective and analytical requirements.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_7px_#22d3ee]" />System Ready</span></div>
            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <label><span className={labelClass}><span>Company Name</span><span className={codeClass}>IDENTITY / 01</span></span><input type="text" placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldClass} /></label>
              <label><span className={labelClass}><span>Industry</span><span className={codeClass}>SECTOR / 02</span></span><select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}><option value="">Select Industry</option><option>Interior Design</option><option>Digital Marketing</option><option>E-commerce</option><option>Real Estate</option><option>Healthcare</option><option>Education</option><option>Restaurant</option><option>Manufacturing</option><option>Technology / SaaS</option><option>Finance</option><option>Marketing Agency</option><option>Travel & Tourism</option><option>Fitness</option><option>Other</option></select></label>
              {[["Monthly Website Visitors", "TRAFFIC / 03", monthlyVisitors, setMonthlyVisitors], ["Monthly Leads", "LEADS / 04", monthlyLeads, setMonthlyLeads], ["Monthly Sales", "SALES / 05", monthlySales, setMonthlySales], ["Monthly Revenue", "REVENUE / 06", monthlyRevenue, setMonthlyRevenue], ["Monthly Marketing Budget", "BUDGET / 07", marketingBudget, setMarketingBudget]].map(([label, code, value, setter]) => <label key={String(code)}><span className={labelClass}><span>{String(label)}</span><span className={codeClass}>{String(code)}</span></span><input type="text" inputMode="numeric" placeholder={`Enter ${String(label)}`} value={String(value)} onChange={(e) => (setter as typeof setMonthlyVisitors)(e.target.value)} className={fieldClass} /></label>)}
              <label><span className={labelClass}><span>Business Goal</span><span className={codeClass}>OBJECTIVE / 08</span></span><select value={businessGoal} onChange={(e) => setBusinessGoal(e.target.value)} className={selectClass} style={{ colorScheme: "dark" }}><option value="">Select Business Goal</option><option>Increase Sales</option><option>Generate More Leads</option><option>Increase Website Traffic</option><option>Improve Conversion Rate</option><option>Improve Marketing ROI</option><option>Increase Brand Awareness</option><option>Scale Business</option><option>Other</option></select></label>
              <label className="md:col-span-2"><span className={labelClass}><span>Business Description</span><span className={codeClass}>CONTEXT / 09</span></span><textarea rows={5} placeholder="Business Description" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} className={`${fieldClass} resize-y`} /></label>
            </div>
            <button onClick={handleGenerate} disabled={loading} className={`mt-7 flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-sm font-bold uppercase tracking-[0.12em] transition sm:px-7 ${loading ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500" : "border-red-500/40 bg-gradient-to-r from-red-600 via-red-700 to-[#090c15] text-white shadow-[0_0_30px_rgba(239,68,68,0.18)] hover:border-red-400/70 hover:shadow-[0_0_40px_rgba(239,68,68,0.28)]"}`}><span>{loading ? "Generating Analytics Intelligence..." : "Generate Analytics Intelligence"}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">→</span></button>
          </section>

          {!analyticsResult ? (
            <section className="mt-8 rounded-[28px] border border-dashed border-red-500/20 bg-slate-950/45 px-6 py-14 text-center sm:px-10"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><AnalyticsIcon /></div><p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Performance Output / Standby</p><h2 className="mt-3 text-2xl font-semibold">Your Analytics Intelligence will appear here</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">Configure the performance brief to generate conversion analysis, marketing efficiency, revenue insights and scalable growth recommendations.</p></section>
          ) : (
            <section className="mt-8">
              <div className="flex flex-col gap-5 rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Performance Output / Ready</p><h2 className="mt-2 text-2xl font-semibold">Generated Analytics Intelligence</h2></div><div className="flex flex-wrap gap-2"><button onClick={copyEntireReport} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10"><CopyIcon />Copy Entire Analytics Report</button><button onClick={downloadPDF} className="rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/10">Download PDF</button><button onClick={handleGenerate} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-red-500/30 hover:text-white">Regenerate</button><button onClick={continueToAIManager} className="rounded-xl border border-cyan-400/15 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200">Continue to AI Manager →</button></div></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([label, value, helper]) => <div key={label} className="rounded-2xl border border-red-500/15 bg-slate-950/65 p-5 transition hover:border-cyan-400/25"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>)}</div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <section className="rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_32px_rgba(239,68,68,0.04)] sm:p-7">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Funnel Performance / Live</p>
                  <h3 className="mt-2 text-xl font-semibold">Visitors → Leads → Sales</h3>
                  <p className="mt-1 text-sm text-slate-500">Conversion stages use their own contextual scale so each step remains readable.</p>
                  <div className="mt-6 space-y-3">
                    {[
                      ["Website Visitors", visitors.toLocaleString(), "100", "Traffic baseline"],
                      ["Leads", leads.toLocaleString(), leadConversionRate, `${leadConversionRate}% visitor → lead`],
                      ["Sales", sales.toLocaleString(), salesConversionRate, `${salesConversionRate}% lead → sale`],
                    ].map(([label, value, width, helper], index) => (
                      <div key={label} className="relative rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                        <div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stage / 0{index + 1}</p><p className="mt-1 text-sm font-medium text-slate-300">{label}</p></div><p className="text-2xl font-semibold text-white">{value}</p></div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-400" style={{ width: `${Math.min(100, Number(width))}%` }} /></div>
                        <p className="mt-2 text-xs text-cyan-300/75">{helper}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_32px_rgba(239,68,68,0.04)] sm:p-7">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Financial Performance / Live</p>
                  <h3 className="mt-2 text-xl font-semibold">Revenue Efficiency</h3>
                  <p className="mt-1 text-sm text-slate-500">Revenue and marketing spend share a dedicated monetary scale.</p>
                  <div className="mt-6 space-y-4">
                    {[
                      ["Monthly Revenue", `₹${revenue.toLocaleString()}`, revenueScaleWidth, "bg-red-500"],
                      ["Monthly Marketing Spend", `₹${budget.toLocaleString()}`, budgetScaleWidth, "bg-cyan-400"],
                    ].map(([label, value, width, color]) => (
                      <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                        <div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-400">{label}</p><p className="text-lg font-semibold">{value}</p></div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${Number(width)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><p className="text-xs text-slate-500">Average Sale Value</p><p className="mt-2 text-2xl font-semibold">₹{averageSaleValue.toLocaleString()}</p><p className="mt-1 text-xs text-cyan-300/70">Revenue ÷ Sales</p></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><p className="text-xs text-slate-500">Marketing ROI</p><p className="mt-2 text-2xl font-semibold">{marketingROI}%</p><p className="mt-1 text-xs leading-5 text-cyan-300/70">(Revenue − Spend) ÷ Spend × 100</p></div>
                  </div>
                </section>
              </div>
              <div className="mt-5 grid gap-5">{modules.map(([number, title, category, value]) => <article key={String(number)} className="relative overflow-hidden rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_35px_rgba(239,68,68,0.04)] transition hover:border-red-400/30 sm:p-7"><div className="absolute left-0 top-8 h-12 w-px bg-gradient-to-b from-red-400 to-cyan-400" /><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-red-300">Module / {number}</span><span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] font-bold tracking-[0.16em] text-cyan-300">{category}</span></div><h3 className="mt-2 text-xl font-semibold">{title}</h3></div><button onClick={() => copyText(value, String(title))} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"><CopyIcon />Copy</button></div><p className="mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{String(value ?? "")}</p></article>)}</div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default function AnalyticsAI() {
  return <Suspense fallback={null}><AnalyticsAIContent /></Suspense>;
}
