"use client";
import { Suspense, useEffect, useState } from "react";
import jsPDF from "jspdf";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";
import auth from "../../lib/auth";

function LogoAIPageContent() {
  const { project, projectId } = useProjectMemory();
      const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandStyle, setBrandStyle] = useState("");
  const [logoIdea, setLogoIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  useEffect(() => {
  if (!projectId) return;

  // Clear fields/results from the previously opened project.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setShowResults(false);
  setCompanyName("");
  setIndustry("");
  setBrandStyle("Minimal");
  setLogoIdea("");

  // Wait for this exact database project.
  if (!project || project.id !== projectId) return;

  setCompanyName(project.companyName || "");
  setIndustry(project.industry || "");

  if (project.brandStyle) {
    setBrandStyle(project.brandStyle);
  }

  // Temporary Logo AI draft handoff, if one exists.
  const savedPrompt = localStorage.getItem(
    "easy-platform-logo-prompt"
  );

  if (savedPrompt) {
    setLogoIdea(savedPrompt);
    localStorage.removeItem("easy-platform-logo-prompt");
  }
}, [projectId, project]);
  const [logoResult, setLogoResult] = useState({
  concept:
    "A premium minimal monogram with elegant geometric lines representing luxury and trust.",
  symbol:
    "A modern crown combined with the first letter of the brand.",
  colors:
    "Matte Black, Gold, White",
  typography:
    "Modern Serif with Luxury Sans combination",
  meaning:
    "Represents premium quality, confidence and timeless elegance.",
});
const formatResults = (): string => {
  return `
Logo AI Results

Concept:
${logoResult.concept}

Symbol:
${logoResult.symbol}

Colors:
${logoResult.colors}

Typography:
${logoResult.typography}

Meaning:
${logoResult.meaning}
`;
};

const handleCopyResults = async () => {
  try {
    await navigator.clipboard.writeText(formatResults());
    alert("Logo AI results copied successfully!");
  } catch (error) {
    console.error(error);
    alert("Failed to copy results.");
  }
};

const handleDownloadPDF = () => {
  try {
    const pdf = new jsPDF();

    pdf.setFontSize(20);
    pdf.text("Logo AI Results", 20, 20);

    pdf.setFontSize(12);

    const lines = pdf.splitTextToSize(formatResults(), 170);

    pdf.text(lines, 20, 35);

    pdf.save("Logo-AI-Results.pdf");
  } catch (error) {
    console.error(error);
    alert("Failed to download PDF.");
  }
};
  const handleGenerateLogo = async () => {
    console.log("BUTTON CLICKED");
  const currentUser = auth.currentUser;

  if (!currentUser) {
    alert("Please log in first.");
    return;
  }

  if (!projectId) {
    alert("Please open a project before generating a logo.");
    return;
  }

  if (!companyName || !industry || !brandStyle || !logoIdea) {
    alert("Please fill in all fields.");
    return;
  }

  setLoading(true);
  setShowResults(false);

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/logo-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        companyName,
        industry,
        brandStyle,
        logoIdea,
        projectId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Logo AI request failed.");
    }

    const result = data.output ?? data;

    setLogoResult({
      concept: result.concept || "No concept returned.",
      symbol: result.symbol || "No symbol returned.",
      colors: result.colors || "No colors returned.",
      typography: result.typography || "No typography returned.",
      meaning: result.meaning || "No meaning returned.",
    });

    setShowResults(true);
  } catch (error) {
    console.error("Logo AI frontend error:", error);

    alert(
      error instanceof Error
        ? error.message
        : "Something went wrong while generating the logo."
    );
  } finally {
    setLoading(false);
  }
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
                <circle cx="12" cy="12" r="3.25" />
                <path d="M12 8.75V3M15.1 13.1 21 16M8.9 13.1 3 16" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Visual Identity</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Logo Intelligence</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Generate professional logos, brand identities and creative logo concepts using AI.</p>
            </div>
          </header>

          <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
            <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Identity Input</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Tell us about your brand</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Define the core signals for the identity generation system.</p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><circle cx="10" cy="10" r="3"/><path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.7 4.7l2.1 2.1M13.2 13.2l2.1 2.1M4.7 15.3l2.1-2.1M13.2 6.8l2.1-2.1"/></svg></div>
            </div>

            <div className="relative mt-6 grid gap-5 md:grid-cols-2">
              <label className="group/field block">
                <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Company Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Identity / 01</span></span>
                <input type="text" placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" />
              </label>
              <label className="group/field block">
                <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Industry</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Market / 02</span></span>
                <span className="relative block">
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <option value="" disabled>Select industry</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Technology">Technology</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Interior Design">Interior Design</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="Finance">Finance</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Hospitality">Hospitality</option>
                    <option value="Other">Other</option>
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 transition-colors group-focus-within/field:border-red-400/35 group-focus-within/field:text-red-300">
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
                  </span>
                </span>
              </label>
              <label className="group/field block md:col-span-2">
                <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Brand Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Aesthetic / 03</span></span>
                <span className="relative block">
                  <select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <option value="" disabled>Select brand style</option>
                    <option value="Modern">Modern</option>
                    <option value="Luxury">Luxury</option>
                    <option value="Minimal">Minimal</option>
                    <option value="Elegant">Elegant</option>
                    <option value="Bold">Bold</option>
                    <option value="Futuristic">Futuristic</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Creative">Creative</option>
                    <option value="Premium">Premium</option>
                    <option value="Playful">Playful</option>
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 transition-colors group-focus-within/field:border-red-400/35 group-focus-within/field:text-red-300">
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
                  </span>
                </span>
              </label>
              <label className="group/field block md:col-span-2">
                <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Logo Idea</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Concept / 04</span></span>
                <textarea placeholder="Describe your logo idea..." value={logoIdea} onChange={(e) => setLogoIdea(e.target.value)} className="h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" />
              </label>
            </div>

            <button onClick={handleGenerateLogo} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-400 opacity-60" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="m10 2 1.7 5.3L17 9l-5.3 1.7L10 16l-1.7-5.3L3 9l5.3-1.7L10 2Z"/></svg>
              {loading ? "Generating..." : "Generate Logo"}
              {!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}
            </button>
          </section>

          {showResults && (
            <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl" />

              <div className="relative flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] pb-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M12 3 21 8v8l-9 5-9-5V8l9-5Z"/><circle cx="12" cy="12" r="3"/></svg></div>
                  <div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Identity output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Logo AI Results</h2></div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" onClick={handleCopyResults} className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Results</button>
                  <button type="button" onClick={handleDownloadPDF} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-500/25 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-red-100 transition-all hover:-translate-y-0.5 hover:border-red-400/50 hover:bg-red-500/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button>
                  <button type="button" onClick={handleGenerateLogo} disabled={loading} className="group flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:rotate-180" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>{loading ? "Generating..." : "Regenerate"}</button>
                </div>
              </div>

              <div className="relative mt-6 grid gap-4 md:grid-cols-2">
                {[
                  { code: "01", label: "Logo Concept", value: logoResult.concept },
                  { code: "02", label: "Symbol Idea", value: logoResult.symbol },
                  { code: "03", label: "Color Palette", value: logoResult.colors },
                  { code: "04", label: "Typography", value: logoResult.typography },
                ].map((item) => (
                  <article key={item.code} className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-400/30 hover:shadow-[0_0_22px_rgba(239,68,68,0.07)]">
                    <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-40 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/[0.06] font-mono text-[9px] font-bold text-red-300">{item.code}</span><div><span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-400/75"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Output module</span><h3 className="mt-0.5 text-sm font-semibold text-white">{item.label}</h3></div></div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{item.value}</p>
                  </article>
                ))}
              </div>

              <article className="group relative mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/65 p-5 transition-all duration-300 hover:border-red-400/30 hover:shadow-[0_0_22px_rgba(239,68,68,0.07)] sm:p-6">
                <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-40 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/[0.06] font-mono text-[9px] font-bold text-red-300">05</span><div><span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-400/75"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Output module</span><h3 className="mt-0.5 text-sm font-semibold text-white">Brand Meaning</h3></div></div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{logoResult.meaning}</p>
              </article>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default function LogoAIPage() {
  return <Suspense fallback={null}><LogoAIPageContent /></Suspense>;
}
