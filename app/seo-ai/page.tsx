"use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { useProjectMemory } from "../hooks/useProjectMemory";

const SEO_GOALS = [
  "Generate Leads",
  "Sell Products",
  "Showcase Portfolio",
  "Book Appointments",
  "Build Brand Awareness",
  "Provide Information",
  "Grow Online Presence",
  "Offer Online Services",
  "Community & Membership",
  "Other",
] as const;

type SEOResult = Record<string, unknown> & {
  blogTopics?: string;
  colourScheme?: string;
  designRecommendations?: string;
  growthRecommendations?: string;
  internalLinking?: string;
  keywordResearch?: string;
  keywords?: string;
  kpis?: string;
  metaDescriptions?: string;
  metaTitles?: string;
  recommendedPages?: string;
  seoAudit?: string;
  seoContentPlan?: string;
  seoScore?: string;
  seoStrategy?: string;
  siteStructure?: string;
  technicalSEO?: string;
  typography?: string;
  websiteFeatures?: string;
};

const cleanGrowthRecommendations = (value?: string) =>
  value?.replace(
    /^[ \t]*Note:\s*Duplicate field per required schema\s*[—–-]\s*repeated condensed action plan\.[ \t]*(?:\r?\n)?/gim,
    "",
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const SearchIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="10.5" cy="10.5" r="5.5" />
    <path d="m15 15 5 5M7.5 10.5h6M10.5 7.5v6" />
  </svg>
);

const CopyIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

function SEOAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandStyle, setBrandStyle] = useState("Minimal");
  const [brandDescription, setBrandDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandResult, setBrandResult] = useState<SEOResult | null>(null);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      const activeProject = project?.id === projectId ? project : null;
      const projectGoal = activeProject?.goal || "";

      setBrandResult(null);
      setCompanyName(activeProject?.companyName || "");
      setIndustry(activeProject?.industry || "");
      setTargetAudience(
        SEO_GOALS.includes(projectGoal as (typeof SEO_GOALS)[number])
          ? projectGoal
          : "",
      );
      setBrandDescription(activeProject?.businessDescription || activeProject?.originalBrief || "");
    });

    return () => {
      active = false;
    };
  }, [project, projectId]);
  useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedSEOOutput = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=seo`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load SEO AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setBrandResult(savedResult as SEOResult);
    } catch (error) {
      console.error("Failed to restore SEO AI output:", error);
    }
  };

  loadSavedSEOOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.userId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const copyEntireSEO = () => {
    if (!brandResult) return;
    const content = `
Website Overview:
${brandResult.seoStrategy}

Website Goal:
${brandResult.keywordResearch}

Brand Story:
${brandResult.recommendedPages}

Mission:
${brandResult.siteStructure}

Website Features:
${brandResult.websiteFeatures}

Design Recommendations:
${brandResult.designRecommendations}

Colour Scheme:
${brandResult.colourScheme}

Typography:
${brandResult.typography}

Logo Concept:
${brandResult.seoContentPlan}

SEO Recommendations:
${cleanGrowthRecommendations(brandResult.growthRecommendations)}
`;
    navigator.clipboard.writeText(content);
    toast.success("SEO Plan copied!");
  };

  const continueToUIUX = () => {
    if (!brandResult) {
      toast.error("Generate the SEO plan first.");
      return;
    }
    window.location.href = projectId
      ? `/uiux-ai?projectId=${encodeURIComponent(projectId)}`
      : "/uiux-ai";
  };

  const downloadPDF = () => {
    if (!brandResult) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("SEO Strategy Report", 20, 20);
    let y = 35;
    const addSection = (title: string, value?: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(title, 20, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value || "", 170);
      if (y + 20 > 270) { doc.addPage(); y = 20; }
      if (y + 10 + lines.length * 7 > 270) { doc.addPage(); y = 20; }
      doc.text(lines, 20, y);
      y += lines.length * 7 + 14;
    };
    addSection("SEO Audit", brandResult.seoAudit);
    addSection("Keywords", brandResult.keywords);
    addSection("Meta Titles", brandResult.metaTitles);
    addSection("Meta Descriptions", brandResult.metaDescriptions);
    addSection("Internal Linking", brandResult.internalLinking);
    addSection("Blog Topics", brandResult.blogTopics);
    addSection("Technical SEO Suggestions", brandResult.technicalSEO);
    addSection("SEO Score", brandResult.seoScore);
    addSection("KPIs", brandResult.kpis);
    addSection("Growth Recommendations", cleanGrowthRecommendations(brandResult.growthRecommendations));
    doc.save(`${companyName}-SEO-Strategy.pdf`);
    toast.success("PDF downloaded!");
  };

  const saveProject = async () => {
    if (!brandResult) {
      toast.error("Generate an SEO strategy first.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      toast.error("You must be logged in to save a project.");
      return;
    }

    try {
      const response = await authenticatedFetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          userId: user.uid,
          name: `${companyName} SEO Project`,
          companyName,
          industry,
          targetAudience,
          goal: targetAudience,
          brandStyle,
          brandDescription,
          result: JSON.stringify(brandResult),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("SEO project save failed:", data);
        toast.error("Failed to save project.");
        return;
      }

      toast.success("Project saved successfully!");
    } catch (error) {
      console.error("SEO project save error:", error);
      toast.error("Failed to save project.");
    }
  };

  const handleGenerateBrand = async () => {
    if (!companyName || !industry || !targetAudience || !brandDescription) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast.error("Please log in first.");
      return;
    }

    if (!projectId) {
      toast.error("Please open a project before generating SEO intelligence.");
      return;
    }

    setLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/seo-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          companyName,
          industry,
          targetAudience,
          brandStyle,
          brandDescription,
          projectId,
        }),
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      console.log("RAW RESPONSE:", text);
      console.log("STATUS:", response.status);
      if (!text.trim()) throw new Error("n8n returned EMPTY response");
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      console.log("PARSED:", parsed);
      let result: unknown = parsed;
      while (true) {
        if (typeof result === "string") { result = JSON.parse(result); continue; }
        if (isRecord(result) && "text" in result && isRecord(result.text)) {
          result = result.text;
          continue;
        }
        if (isRecord(result) && "output" in result) {
          result = typeof result.output === "string" ? JSON.parse(result.output) : result.output;
          continue;
        }
        break;
      }
      const finalSEOResult = isRecord(result)
  ? (result as SEOResult)
  : null;

setBrandResult(finalSEOResult);

if (projectId && project?.userId && finalSEOResult) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: project.userId,
      module: "seo",
      result: finalSEOResult,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save SEO AI output");
  }
}
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const resetStrategy = () => {
    setCompanyName("");
    setIndustry("");
    setTargetAudience("");
    setBrandStyle("Minimal");
    setBrandDescription("");
    setBrandResult(null);
  };

  const modules = brandResult ? [
    ["01", "SEO Audit", "TECHNICAL", brandResult.seoAudit],
    ["02", "Keywords", "DISCOVERY", brandResult.keywords],
    ["03", "Meta Titles", "ON-PAGE", brandResult.metaTitles],
    ["04", "Meta Descriptions", "ON-PAGE", brandResult.metaDescriptions],
    ["05", "Internal Linking", "ARCHITECTURE", brandResult.internalLinking],
    ["06", "Blog Topics", "CONTENT", brandResult.blogTopics],
    ["07", "Technical SEO Suggestions", "TECHNICAL", brandResult.technicalSEO],
    ["08", "SEO KPIs", "MEASUREMENT", brandResult.kpis],
    ["09", "Growth Recommendations", "GROWTH", cleanGrowthRecommendations(brandResult.growthRecommendations)],
  ] : [];
  const fieldClass = "w-full rounded-xl border border-slate-700/70 bg-[#070b16]/90 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-red-500/30 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10";
  const selectClass = `${fieldClass} appearance-none pr-11`;
  const labelClass = "mb-2 flex items-center justify-between text-sm font-medium";
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
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.14)]">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-cyan-400/10" />
                <SearchIcon className="relative h-7 w-7" />
                <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300">Search Intelligence</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">SEO Intelligence</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">Engineer complete search visibility systems, keyword strategy, technical SEO and scalable organic growth through one intelligent optimization engine.</p>
              </div>
            </div>
            <button onClick={resetStrategy} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
              New SEO Strategy
            </button>
          </header>

          <section className="relative mt-10 overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 shadow-[0_0_60px_rgba(239,68,68,0.07)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-red-300">SEO Generation Matrix</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Configure the search brief</h2><p className="mt-2 text-sm leading-6 text-slate-500">Define business context, search objective, strategic direction and optimization requirements.</p></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_7px_#22d3ee]" />System Ready</span>
            </div>
            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <label className="block"><span className={labelClass}><span>Business Name</span><span className={codeClass}>IDENTITY / 01</span></span><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Example: Buzypeezy" className={fieldClass} /></label>
              <label className="block"><span className={labelClass}><span>Industry</span><span className={codeClass}>SECTOR / 02</span></span><div className="relative"><select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Legal</option><option>Manufacturing</option><option>Other</option></select><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400">⌄</span></div></label>
              <label className="block"><span className={labelClass}><span>SEO Goal</span><span className={codeClass}>OBJECTIVE / 03</span></span><div className="relative"><select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className={selectClass}><option value="">Select Marketing Goal</option><option>Generate Leads</option><option>Sell Products</option><option>Showcase Portfolio</option><option>Book Appointments</option><option>Build Brand Awareness</option><option>Provide Information</option><option>Grow Online Presence</option><option>Offer Online Services</option><option>Community & Membership</option><option>Other</option></select><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400">⌄</span></div></label>
              <label className="block"><span className={labelClass}><span>SEO Strategy</span><span className={codeClass}>STRATEGY / 04</span></span><div className="relative"><select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className={selectClass}><option>Minimal</option><option>Modern</option><option>Corporate</option><option>Luxury</option><option>Creative</option><option>Dark</option><option>Light</option><option>Glassmorphism</option><option>Neumorphism</option><option>Futuristic</option></select><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400">⌄</span></div></label>
              <label className="block md:col-span-2"><span className={labelClass}><span>Business Description</span><span className={codeClass}>CONTEXT / 05</span></span><textarea rows={5} value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} placeholder="Describe your business, products or services, target customers, marketing goals, and current challenges..." className={`${fieldClass} resize-y`} /></label>
            </div>
            <button onClick={handleGenerateBrand} disabled={loading} className={`mt-7 flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-sm font-bold uppercase tracking-[0.12em] transition sm:px-7 ${loading ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500" : "border-red-500/40 bg-gradient-to-r from-red-600 via-red-700 to-[#090c15] text-white shadow-[0_0_30px_rgba(239,68,68,0.18)] hover:border-red-400/70 hover:shadow-[0_0_40px_rgba(239,68,68,0.28)]"}`}><span>{loading ? "Generating SEO Intelligence..." : "Generate SEO Intelligence"}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">→</span></button>
          </section>

          {!brandResult ? (
            <section className="mt-8 rounded-[28px] border border-dashed border-red-500/20 bg-slate-950/45 px-6 py-14 text-center sm:px-10"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><SearchIcon /></div><p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Search Output / Standby</p><h2 className="mt-3 text-2xl font-semibold">Your SEO Intelligence will appear here</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">Configure the search brief to generate keyword intelligence, technical recommendations, content strategy, ranking opportunities and scalable organic growth direction.</p></section>
          ) : (
            <section className="mt-8">
              <div className="flex flex-col gap-5 rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Search Output / Ready</p><h2 className="mt-2 text-2xl font-semibold">Generated SEO Intelligence</h2></div><div className="flex flex-wrap gap-2"><button onClick={copyEntireSEO} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/10"><CopyIcon />Copy Entire SEO Strategy</button><button onClick={downloadPDF} className="rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/10">Download PDF</button><button onClick={saveProject} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 3.5h10l2 2v11H4zM7 3.5v5h6v-5M7 13h6" /></svg>Save Project</button><button onClick={handleGenerateBrand} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-red-500/30 hover:text-white">Regenerate</button><button onClick={continueToUIUX} className="rounded-xl border border-violet-400/20 bg-violet-500/5 px-4 py-2.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/10">Continue to UI/UX AI →</button></div></div>
              <div className="mt-6 rounded-[26px] border border-red-500/20 bg-gradient-to-br from-red-500/10 via-slate-950/80 to-cyan-400/5 p-6 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-cyan-300">System Health / 00</p><h3 className="mt-2 text-xl font-semibold">SEO Score</h3></div><div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-5 py-3 text-2xl font-bold text-cyan-300">{String(brandResult.seoScore).match(/\d+\/100/)?.[0] || brandResult.seoScore}</div></div><div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-400 transition-all duration-700" style={{ width: `${Math.min(100, Number(String(brandResult.seoScore).match(/\d+/)?.[0] || 0))}%` }} /></div></div>
              <div className="mt-6 grid gap-5">{modules.map(([number, title, category, value]) => <article key={String(number)} className="relative overflow-hidden rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_35px_rgba(239,68,68,0.04)] sm:p-7"><div className="absolute left-0 top-8 h-12 w-px bg-gradient-to-b from-red-400 to-cyan-400" /><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-red-300">Module / {number}</span><span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] font-bold tracking-[0.16em] text-cyan-300">{category}</span></div><h3 className="mt-2 text-xl font-semibold">{title}</h3></div><button onClick={() => copyToClipboard(String(value ?? ""), String(title))} className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"><CopyIcon />Copy</button></div><p className="mt-5 whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-slate-300 sm:text-base">{value}</p></article>)}</div>
              <div className="mt-6 rounded-[28px] border border-cyan-500/15 bg-slate-950/60 p-6 sm:p-8"><p className="text-[9px] uppercase tracking-[0.28em] text-cyan-300">Performance Intelligence</p><h3 className="mt-2 text-2xl font-semibold">SEO Performance Overview</h3><div className="mt-6 grid gap-4 sm:grid-cols-3">{[["SEO Score", String(brandResult.seoScore).match(/\d+\/100/)?.[0] || brandResult.seoScore], ["Keyword Coverage", "20+"], ["Optimization Areas", "8"]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div></div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SEOAIPage() {
  return <Suspense fallback={null}><SEOAIPageContent /></Suspense>;
}
