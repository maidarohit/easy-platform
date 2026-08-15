 "use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import WebsitePreview from "../components/WebsitePreview";
import type { WebsiteAiOutput } from "../../lib/ai";
import auth from "../../lib/auth";
import { useProjectMemory } from "../../hooks/useProjectMemory";

const WEBSITE_GOALS = [
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

function WebsiteAIPageContent() {
    const { project, projectId } = useProjectMemory();
    const [companyName, setCompanyName] = useState("");
const [industry, setIndustry] = useState("");
const [targetAudience, setTargetAudience] = useState("");
const [brandStyle, setBrandStyle] = useState("Minimal");
const [brandDescription, setBrandDescription] = useState("");
const [loading, setLoading] = useState(false);
const [brandResult, setBrandResult] = useState<WebsiteAiOutput | null>(null);
const [previewMode, setPreviewMode] = useState<
  "desktop" | "tablet" | "mobile"
>("desktop");
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
      WEBSITE_GOALS.includes(projectGoal as (typeof WEBSITE_GOALS)[number])
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

  const loadSavedWebsiteOutput = async () => {
    try {
      const response = await fetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=website`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Website AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setBrandResult(savedResult as WebsiteAiOutput);
    } catch (error) {
      console.error("Failed to restore Website AI output:", error);
    }
  };

  loadSavedWebsiteOutput();

  return () => {
    active = false;
  };
}, [projectId, project?.userId]);
const colors =
  brandResult?.colourScheme?.match(/#[0-9A-Fa-f]{6}/g) || [];
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
};
const copyEntireBrand = () => {
  if (!brandResult) return;

  const content = `
Website Overview:
${brandResult.websiteOverview}

Website Goal:
${brandResult.websiteGoal}

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
${brandResult.recommendedTechStack}

SEO Recommendations:
${brandResult.seoRecommendations}
`;

  navigator.clipboard.writeText(content);
  toast.success("Website Plan copied!");
};
const downloadPDF = () => {
  if (!brandResult) return;

  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("Website Strategy Report", 20, 20);

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
 

  addSection("Website Overview", brandResult.websiteOverview);
  addSection("Website Goal", brandResult.websiteGoal);
  addSection("Recommended Pages", brandResult.recommendedPages);
  addSection("Site Structure", brandResult.siteStructure);
  addSection("Website Features", brandResult.websiteFeatures);
  addSection("Design Recommendations", brandResult.designRecommendations);
  addSection("Colour Scheme", brandResult.colourScheme);
  addSection("Typography", brandResult.typography);
  addSection("Recommended Tech Stack", brandResult.recommendedTechStack);
  addSection("SEO Recommendations", brandResult.seoRecommendations);

  doc.save(`${companyName}-Website-Strategy.pdf`);

  toast.success("PDF downloaded!");
};

const saveProject = async () => {
  if (!brandResult) {
    toast.error("Generate a website first.");
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
        name: `${companyName} Website Project`,
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
    console.error("Website project save error:", error);
    toast.error("Failed to save project");
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
    "/api/website-ai",
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

const responseText = await response.text();

if (!responseText) {
  throw new Error("API returned an empty response");
}

const data: { output: WebsiteAiOutput } = JSON.parse(responseText);

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
      module: "website",
      result: parsed,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save Website AI output");
  }
}
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error("FULL ERROR:", error);
  toast.error(message);
}
finally {
  setLoading(false);
}
};
const handleNewWebsite = () => {
  setCompanyName("");
  setIndustry("");
  setTargetAudience("");
  setBrandStyle("Minimal");
  setBrandDescription("");
  setBrandResult(null);
  setPreviewMode("desktop");
};

const copyIcon = <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>;
const copyButtonClass = "flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";
const moduleClass = "group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.07)] sm:p-6";
const websiteSections = brandResult
  ? [
      { label: "Website Overview", code: "STRATEGY", value: brandResult.websiteOverview },
      { label: "Website Goal", code: "OBJECTIVE", value: brandResult.websiteGoal },
      { label: "Recommended Pages", code: "SITEMAP", value: brandResult.recommendedPages },
      { label: "Site Structure", code: "ARCHITECTURE", value: brandResult.siteStructure },
      { label: "Website Features", code: "FUNCTIONS", value: brandResult.websiteFeatures },
      { label: "Design Recommendations", code: "VISUAL SYSTEM", value: brandResult.designRecommendations },
      { label: "Colour Scheme", code: "COLOUR", value: brandResult.colourScheme },
      { label: "Typography", code: "TYPE SYSTEM", value: brandResult.typography },
      { label: "Recommended Tech Stack", code: "TECHNOLOGY", value: brandResult.recommendedTechStack },
      { label: "SEO Recommendations", code: "DISCOVERY", value: brandResult.seoRecommendations },
    ]
  : [];

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
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01M7 12h5M7 16h10"/></svg>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Web Intelligence</span></div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Website Intelligence</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Engineer complete conversion-focused websites, architecture, content systems and responsive digital experiences through one intelligent web engine.</p>
              </div>
            </div>
            <button type="button" onClick={handleNewWebsite} className="flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-gradient-to-r from-red-500/15 to-cyan-400/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/55 hover:shadow-[0_0_22px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 sm:w-auto"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M10 3v14M3 10h14"/><circle cx="10" cy="10" r="7.5"/></svg>New Website</button>
          </header>

          <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
            <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/>
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Website Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the website brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define business context, website objective, visual system and functional requirements.</p></div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M6 6h.01M9 6h.01"/></svg></div>
            </div>

            <div className="relative mt-6 grid gap-5 md:grid-cols-2">
              <label className="block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Business Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Identity / 01</span></span><input type="text" placeholder="Example: Easy Platform" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
              <label className="group/industry block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Industry</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Sector / 02</span></span><span className="relative block"><select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Industry</option><option>AI & Technology</option><option>Digital Marketing</option><option>Healthcare</option><option>Finance</option><option>Education</option><option>Real Estate</option><option>E-commerce</option><option>Interior Design</option><option>Food & Beverage</option><option>Legal</option><option>Manufacturing</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/industry:border-red-400/35 group-focus-within/industry:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="group/goal block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Goal</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Objective / 03</span></span><span className="relative block"><select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="">Select Website Goal</option><option>Generate Leads</option><option>Sell Products</option><option>Showcase Portfolio</option><option>Book Appointments</option><option>Build Brand Awareness</option><option>Provide Information</option><option>Grow Online Presence</option><option>Offer Online Services</option><option>Community & Membership</option><option>Other</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/goal:border-red-400/35 group-focus-within/goal:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="group/style block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Aesthetic / 04</span></span><span className="relative block"><select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Minimal</option><option>Modern</option><option>Corporate</option><option>Luxury</option><option>Creative</option><option>Dark</option><option>Light</option><option>Glassmorphism</option><option>Neumorphism</option><option>Futuristic</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/style:border-red-400/35 group-focus-within/style:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Website Requirements</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Requirements / 05</span></span><textarea rows={5} placeholder="Describe your website, required pages, features, design preferences, and any special requirements..." value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>
            </div>

            <button type="button" onClick={handleGenerateBrand} disabled={loading} className={loading ? "relative mt-6 flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl border border-red-500/15 bg-slate-950/80 px-6 py-3 text-sm font-semibold text-slate-400" : "group/button relative mt-6 flex min-h-12 items-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M3 8h14M6 6h.01M9 6h.01"/></svg>}{loading ? "Generating Website Intelligence..." : "Generate Website Intelligence"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
            {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Web synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
          </section>

          {brandResult && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/>
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
              <div className="relative mb-6 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 12h5M7 16h10"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Web output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Website Intelligence</h2></div></div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                  <button type="button" onClick={copyEntireBrand} className={copyButtonClass}>{copyIcon}Copy Entire Website Plan</button>
                  <button type="button" onClick={downloadPDF} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button>
                  <button type="button" onClick={saveProject} className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 3.5h10l2 2v11H4zM7 3.5v5h6v-5M7 13h6"/></svg>Save Project</button>
                  <button type="button" onClick={handleGenerateBrand} disabled={loading} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button>
                  <button type="button" onClick={() => { if (!brandResult) { toast.error("Generate or open a website project first."); return; } window.location.href = projectId ? `/marketing-ai?projectId=${encodeURIComponent(projectId)}` : "/marketing-ai"; }} className={copyButtonClass}><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>Continue to Marketing AI</button>
                </div>
              </div>

              <div className="relative grid gap-5 md:grid-cols-2">
                {websiteSections.map((section, index) => (
                  <article key={section.label} className={index === 0 || [1, 2, 3, 4, 5, 8, 9].includes(index) ? moduleClass + " md:col-span-2" : moduleClass}>
                    <div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[9px] tracking-[0.22em] text-red-300">MODULE / {String(index + 1).padStart(2, "0")}</span><div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-white">{section.label}</h3><span className="rounded-md border border-cyan-400/15 bg-cyan-400/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300">{section.code}</span></div></div><button type="button" onClick={() => copyToClipboard(section.value, section.label)} className={copyButtonClass}>{copyIcon}Copy</button></div>
                    <p className={index === 0 ? "mt-4 whitespace-pre-wrap break-words text-xl font-semibold leading-[1.6] text-slate-100 sm:text-2xl" : "mt-4 whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-slate-300 sm:text-base"}>{section.value}</p>
                    {section.label === "Colour Scheme" && <div className="mt-5 flex flex-wrap gap-4">{colors.map((color: string, colorIndex: number) => <div key={color + "-" + colorIndex} className="rounded-xl border border-white/[0.07] bg-slate-900/70 p-2 text-center"><div className="h-12 w-12 rounded-lg border border-white/20 shadow-[0_0_16px_rgba(255,255,255,0.06)]" style={{ backgroundColor: color }}/><span className="mt-2 block font-mono text-[9px] text-slate-400">{color}</span></div>)}</div>}
                  </article>
                ))}
              </div>

              <section className="relative mt-7 overflow-hidden rounded-[24px] border border-red-500/20 bg-slate-950/60 p-4 shadow-[0_0_30px_rgba(239,68,68,0.06)] sm:p-6">
                <div className="mb-5 flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Web preview / active</span></div><h3 className="mt-2 text-xl font-semibold text-white">Live Website Preview</h3><p className="mt-1 text-xs leading-5 text-slate-500">Inspect the generated experience across responsive viewport systems.</p></div>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.07] bg-slate-900/70 p-1.5">
                    {(["desktop", "tablet", "mobile"] as const).map((mode) => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={previewMode === mode ? "flex items-center justify-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-semibold capitalize text-white shadow-[0_0_16px_rgba(239,68,68,0.12)]" : "flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold capitalize text-slate-400 transition hover:border-cyan-400/20 hover:text-cyan-200"}><svg aria-hidden="true" viewBox="0 0 20 20" className="hidden h-4 w-4 fill-none stroke-cyan-300 sm:block" strokeWidth="1.5">{mode === "desktop" ? <><rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 16.5h6M10 13.5v3"/></> : mode === "tablet" ? <rect x="4.5" y="2" width="11" height="16" rx="1.5"/> : <rect x="6" y="2" width="8" height="16" rx="1.5"/>}</svg>{mode}</button>)}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-black shadow-[0_25px_80px_rgba(0,0,0,0.5),0_0_25px_rgba(239,68,68,0.08)]">
                  <div className="flex items-center gap-3 border-b border-white/[0.08] bg-slate-900/95 px-4 py-3">
                    <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400"/><span className="h-2.5 w-2.5 rounded-full bg-slate-600"/><span className="h-2.5 w-2.5 rounded-full bg-cyan-300"/></div>
                    <div className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.07] bg-slate-950/80 px-3 py-1.5 text-center font-mono text-[9px] text-slate-500">https://{companyName.trim().toLowerCase().replace(/\s+/g, "-") || "your-business"}.com</div>
                    <span className="hidden items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-cyan-300 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/>Live</span>
                  </div>
                  <div className="relative flex min-h-[680px] items-start justify-center overflow-auto bg-slate-950/70 px-2 py-5 sm:px-4">
                    <WebsitePreview companyName={companyName} industry={industry} websiteGoal={targetAudience} websiteStyle={brandStyle} websiteRequirements={brandDescription} previewMode={previewMode} brandResult={brandResult}/>
                  </div>
                </div>
              </section>
            </section>
          )}

          {!brandResult && !loading && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-dashed border-red-500/20 bg-slate-900/45 p-8 text-center sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.06] text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.1)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 12h10M7 16h6"/></svg></div>
              <div className="mt-5 flex items-center justify-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Awaiting website brief</span></div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Your Website Intelligence will appear here</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">Configure the website brief to generate a complete architecture, content direction, feature system, technical plan and responsive live preview.</p>
            </section>
          )}
        </div>
      </div>
    </section>
  </main>
);
}

export default function WebsiteAIPage() {
  return <Suspense fallback={null}><WebsiteAIPageContent /></Suspense>;
}
