 "use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import BrandVisualPreview from "./components/BrandVisualPreview";
import type { BrandingAiOutput } from "../lib/ai";
import auth from "../lib/auth";
import { useProjectMemory } from "../hooks/useProjectMemory";

function BrandingAIPageContent() {
    const { project, projectId } = useProjectMemory();
    const [companyName, setCompanyName] = useState("");
const [industry, setIndustry] = useState("");
const [targetAudience, setTargetAudience] = useState("");
const [brandStyle, setBrandStyle] = useState("Minimal");
const [brandDescription, setBrandDescription] = useState("");
const [loading, setLoading] = useState(false);
const [brandResult, setBrandResult] = useState<BrandingAiOutput | null>(null);
useEffect(() => {
  let active = true;

  queueMicrotask(() => {
    if (!active) return;

    const activeProject = project?.id === projectId ? project : null;

    setBrandResult(null);
    setCompanyName(activeProject?.companyName || "");
    setIndustry(activeProject?.industry || "");
    setTargetAudience(activeProject?.targetAudience || "");
    setBrandDescription(activeProject?.businessDescription || activeProject?.originalBrief || "");
  });

  return () => {
    active = false;
  };
}, [project, projectId]);
useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedBrandingOutput = async () => {
    try {
      const response = await fetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=branding`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Branding AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setBrandResult(savedResult as BrandingAiOutput);
    } catch (error) {
      console.error("Failed to restore Branding AI output:", error);
    }
  };

  loadSavedBrandingOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.userId]);
const colors =
  brandResult?.colorPalette?.match(/#[0-9A-Fa-f]{6}/g) || [];
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
};
const copyEntireBrand = () => {
  if (!brandResult) return;

  const content = `
Brand Name:
${brandResult.brandName}

Tagline:
${brandResult.tagline}

Brand Story:
${brandResult.story}

Mission:
${brandResult.mission}

Vision:
${brandResult.vision}

Brand Voice:
${brandResult.brandVoice}

Color Palette:
${brandResult.colorPalette}

Typography:
${brandResult.typography}

Logo Concept:
${brandResult.logoConcept}

Marketing Suggestions:
${brandResult.marketingSuggestions}
`;

  navigator.clipboard.writeText(content);
  toast.success("Entire Brand Identity copied!");
};
const downloadPDF = () => {
  if (!brandResult) return;

  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("Brand Identity Report", 20, 20);

  let y = 35;

  const addSection = (title: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(title, 20, y);

    y += 7;

    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(value || "", 170);
    doc.text(lines, 20, y);

    y += lines.length * 7 + 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  };

  addSection("Brand Name", brandResult.brandName);
  addSection("Tagline", brandResult.tagline);
  addSection("Brand Story", brandResult.story);
  addSection("Mission", brandResult.mission);
  addSection("Vision", brandResult.vision);
  addSection("Brand Voice", brandResult.brandVoice);
  addSection("Color Palette", brandResult.colorPalette);
  addSection("Typography", brandResult.typography);
  addSection("Logo Concept", brandResult.logoConcept);
  addSection("Marketing Suggestions", brandResult.marketingSuggestions);

  doc.save(`${brandResult.brandName}-Brand-Identity.pdf`);

  toast.success("PDF downloaded!");
};
const saveProject = async () => {
  if (!brandResult) {
    toast.error("Generate a brand first.");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    toast.error("Please log in first.");
    return;
  }

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        userId: user.uid,
        name: `${companyName} Branding Project`,
        companyName,
        industry,
        targetAudience,
        brandStyle,
        brandDescription,
        result: JSON.stringify(brandResult),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save project");
    }

    toast.success("Project saved successfully!");
  } catch (error) {
    console.error("Project save error:", error);
    toast.error("Failed to save project.");
  }
};
const handleGenerateBrand = async () => {
  if (
  !companyName ||
  !industry ||
  !targetAudience ||
  !brandDescription
) {
  toast.error("Please fill in all required fields.");
  return;
}
setLoading(true);
try {
  const response = await fetch(
    "/api/branding-ai",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName,
        industry,
        targetAudience,
        brandStyle,
        brandDescription,
      }),
    }
  );

  if (!response.ok) {
  throw new Error(`HTTP Error: ${response.status}`);
}

const data: { output: BrandingAiOutput } = await response.json();

console.log("Response:", data);
const parsed = data.output;

console.log("Parsed:", parsed);
setBrandResult(parsed);
const currentUser = auth.currentUser;

if (projectId && currentUser) {
  const saveOutputResponse = await fetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: currentUser.uid,
      module: "branding",
      result: parsed,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save Branding AI output");
  }
}
} catch (error) {
  console.error(error);
  toast.error("Something went wrong.");
} finally {
  setLoading(false);
}

};
const handleNewBrand = () => {
  setCompanyName("");
  setIndustry("");
  setTargetAudience("");
  setBrandStyle("Minimal");
  setBrandDescription("");
  setBrandResult(null);
};
  const copyIcon = <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>;
  const copyButtonClass = "flex min-h-9 shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";
  const moduleClass = "group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.07)] sm:p-6";

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <section className="min-w-0 flex-1">
        <Navbar />
        <div className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-500/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-3xl" />
          <div className="mx-auto max-w-6xl">
            <header className="relative mb-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4"><div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M12 3 4.5 7v10L12 21l7.5-4V7z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10M8 5.2l8 4.3"/></svg><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/></div>
              <div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Brand Intelligence</span></div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Brand Intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Engineer a complete brand identity, positioning system and visual direction through one intelligent brand engine.</p></div></div>
              <button type="button" onClick={handleNewBrand} className="flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-gradient-to-r from-red-500/15 to-cyan-400/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/55 hover:shadow-[0_0_22px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 sm:w-auto"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M10 3v14M3 10h14"/><circle cx="10" cy="10" r="7.5"/></svg>New Brand</button>
            </header>

            <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/><div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
              <div className="relative flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Brand Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the brand brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define identity, market position, audience and aesthetic direction.</p></div><div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M4 4h12v12H4zM7 7h6M7 10h6M7 13h4"/></svg></div></div>

              <div className="relative mt-6 grid gap-5 md:grid-cols-2">
                <label className="block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Company Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Identity / 01</span></span><input type="text" placeholder="Example: Easy Platform" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="group/industry block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Industry</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Market / 02</span></span><span className="relative block"><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Legal</option><option>Manufacturing</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/industry:border-red-400/35 group-focus-within/industry:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/audience block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Target Audience</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Audience / 03</span></span><span className="relative block"><select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Target Audience</option><option>Startups</option><option>Small Businesses</option><option>Enterprises</option><option>Students</option><option>Creators</option><option>Freelancers</option><option>Healthcare Professionals</option><option>Retail Customers</option><option>B2B Companies</option><option>B2C Customers</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/audience:border-red-400/35 group-focus-within/audience:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/style block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Brand Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Aesthetic / 04</span></span><span className="relative block"><select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Minimal</option><option>Luxury</option><option>Modern</option><option>Corporate</option><option>Creative</option><option>Tech</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/style:border-red-400/35 group-focus-within/style:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Brand Description</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Context / 05</span></span><textarea rows={5} placeholder="Describe your business, services, goals, unique value, and what makes your brand different..." value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>
              </div>

              <button type="button" onClick={handleGenerateBrand} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-red-500/15 bg-slate-950/80 text-slate-400" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="M10 2.5 12 7l4.5 2-4.5 2-2 4.5L8 11 3.5 9 8 7z"/></svg>}{loading ? "Generating Brand Intelligence..." : "Generate Brand"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
              {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Brand synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
            </section>

            {brandResult && (
              <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
                <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/><div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
                <div className="relative mb-6 flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M12 3 4.5 7v10L12 21l7.5-4V7z"/><path d="m4.5 7 7.5 4 7.5-4M12 11v10"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Brand output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Brand Intelligence</h2></div></div><div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap"><button type="button" onClick={copyEntireBrand} className={copyButtonClass}>{copyIcon}Copy Entire Brand Identity</button><button type="button" onClick={downloadPDF} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button><button type="button" onClick={saveProject} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 3.5h10l2 2v11H4zM7 3.5v5h6v-5M7 13h6"/></svg>Save Project</button></div></div>

                <div className="relative grid gap-5 md:grid-cols-2">
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 01</span><h3 className="mt-1 text-lg font-semibold text-white">Brand Name</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.brandName, "Brand Name")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 text-2xl font-bold leading-tight text-white sm:text-3xl">{brandResult.brandName}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 02</span><h3 className="mt-1 text-lg font-semibold text-white">Tagline</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.tagline, "Tagline")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 text-xl leading-relaxed text-slate-100">{brandResult.tagline}</p></article>
                  <article className={`${moduleClass} md:col-span-2`}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 03</span><h3 className="mt-1 text-lg font-semibold text-white">Brand Story</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.story, "Brand Story")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.story}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 04</span><h3 className="mt-1 text-lg font-semibold text-white">Mission</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.mission, "Mission")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.mission}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 05</span><h3 className="mt-1 text-lg font-semibold text-white">Vision</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.vision, "Vision")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.vision}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 06</span><h3 className="mt-1 text-lg font-semibold text-white">Brand Voice</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.brandVoice, "Brand Voice")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.brandVoice}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 07</span><h3 className="mt-1 text-lg font-semibold text-white">Color Palette</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.colorPalette, "Color Palette")} className={copyButtonClass}>{copyIcon}Copy</button></div><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-[1.8] text-slate-300">{brandResult.colorPalette}</pre><div className="mt-5 flex flex-wrap gap-4">{colors.map((color: string) => <div key={color} className="rounded-xl border border-white/[0.07] bg-slate-900/70 p-2 text-center"><div className="h-12 w-12 rounded-lg border border-white/20 shadow-[0_0_16px_rgba(255,255,255,0.06)]" style={{ backgroundColor: color }}/><span className="mt-2 block font-mono text-[9px] text-slate-400">{color}</span></div>)}</div></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 08</span><h3 className="mt-1 text-lg font-semibold text-white">Typography</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.typography, "Typography")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.typography}</p></article>
                  <article className={moduleClass}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 09</span><h3 className="mt-1 text-lg font-semibold text-white">Logo Concept</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.logoConcept, "Logo Concept")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.logoConcept}</p></article>
                  <article className={`${moduleClass} md:col-span-2`}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 10</span><h3 className="mt-1 text-lg font-semibold text-white">Marketing Suggestions</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.marketingSuggestions, "Marketing Suggestions")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.marketingSuggestions}</p></article>
                  <article className={`${moduleClass} md:col-span-2`}><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 11</span><h3 className="mt-1 text-lg font-semibold text-white">Brand Style Guide</h3></div><button type="button" onClick={() => copyToClipboard(brandResult.brandStyleGuide, "Brand Style Guide")} className={copyButtonClass}>{copyIcon}Copy</button></div><p className="mt-4 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">{brandResult.brandStyleGuide}</p></article>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/55 p-3 sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / 12</span><span className="h-1 w-1 rounded-full bg-cyan-300"/><span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Visual direction</span></div><BrandVisualPreview brandResult={brandResult} /></div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function BrandingAIPage() {
  return <Suspense fallback={null}><BrandingAIPageContent /></Suspense>;
}
