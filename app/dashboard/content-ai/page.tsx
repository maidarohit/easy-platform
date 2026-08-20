"use client";

import jsPDF from "jspdf";
import { Suspense, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";
import auth from "../../lib/auth";

function ContentAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("Social Media Post");
  const [tone, setTone] = useState("Professional");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState("Medium");
  const [keywords, setKeywords] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
  if (!projectId) return;

  // Clear output from a previously opened project.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setContent("");
  setError("");

  // Wait for the exact database project to load.
  if (!project || project.id !== projectId) return;

  // Use saved project audience only when one actually exists.
  setAudience(project.targetAudience || "");

  // Temporary Creative AI draft handoff.
  const savedPrompt = localStorage.getItem(
    "easy-platform-creative-prompt"
  );

  if (savedPrompt) {
    setPrompt(savedPrompt);
    localStorage.removeItem("easy-platform-creative-prompt");
  }
}, [projectId, project]);

  const handleGenerateContent = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Please log in first.");
      return;
    }

    if (!projectId) {
      setError("Please open a project before generating content.");
      return;
    }

    if (!prompt.trim()) {
      setError("Please enter a topic or content brief.");
      return;
    }

    setLoading(true);
    setError("");
    setContent("");

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/content-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt,
          contentType,
          tone,
          audience,
          length,
          keywords,
          projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Content generation failed.");
      }

      const data = await response.json();

      const generatedContent =
        data.content ||
        data.output ||
        data.text ||
        data.result ||
        "";

      if (!generatedContent) {
        throw new Error("No content was returned.");
      }

      setContent(
        typeof generatedContent === "string"
          ? generatedContent
          : JSON.stringify(generatedContent, null, 2)
      );
    } catch (err) {
      console.error("Content generation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating content."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      alert("Content copied successfully.");
    } catch {
      alert("Unable to copy the content.");
    }
  };

  const handleDownloadPDF = () => {
    if (!content) return;

    const doc = new jsPDF();
    const margin = 20;
    const maxWidth = 170;
    const pageBottom = 277;
    let y = 20;

    const ensureSpace = (height: number) => {
      if (y + height <= pageBottom) return;
      doc.addPage();
      y = 20;
    };

    const addSection = (title: string, value: string) => {
      if (!value.trim()) return;

      ensureSpace(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(value, maxWidth) as string[];
      for (const line of lines) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 6;
      }
      y += 5;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Content AI Result", margin, y);
    y += 14;

    addSection("Content Type", contentType);
    addSection("Tone", tone);
    addSection("Content Length", length);
    addSection("Target Audience", audience);
    addSection("Keywords", keywords);
    addSection("Generated Content", content);

    doc.save("Content-AI-Result.pdf");
  };

  return (
    <main className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />

      <section className="min-w-0 flex-1">
        <Navbar />

        <div className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-500/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-3xl" />
          <div className="mx-auto max-w-6xl">
            <header className="relative mb-9 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h6"/></svg><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/></div>
              <div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Content Intelligence</span></div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Content Engine</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Generate professional social, editorial, campaign, product and website content through one intelligent production system.</p></div>
            </header>

            <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/><div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
              <div className="relative flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Content Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the content brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define format, voice, audience and key messaging signals.</p></div><div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M4 3h9l3 3v11H4zM13 3v4h3M7 10h6M7 13h5"/></svg></div></div>

              <div className="relative mt-6 grid gap-5 md:grid-cols-3">
                <label className="group/type block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Content Type</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Format / 01</span></span><span className="relative block"><select value={contentType} onChange={(event) => setContentType(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Social Media Post</option><option>Instagram Caption</option><option>LinkedIn Post</option><option>Blog Article</option><option>Product Description</option><option>Email Campaign</option><option>Advertisement Copy</option><option>Website Content</option><option>Video Script</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/type:border-red-400/35 group-focus-within/type:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/tone block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Tone</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Voice / 02</span></span><span className="relative block"><select value={tone} onChange={(event) => setTone(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Professional</option><option>Friendly</option><option>Persuasive</option><option>Luxury</option><option>Informative</option><option>Conversational</option><option>Bold</option><option>Inspirational</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/tone:border-red-400/35 group-focus-within/tone:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/length block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Content Length</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Scale / 03</span></span><span className="relative block"><select value={length} onChange={(event) => setLength(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Short</option><option>Medium</option><option>Long</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/length:border-red-400/35 group-focus-within/length:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              </div>

              <div className="relative mt-5 grid gap-5 md:grid-cols-2">
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Target Audience</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Audience / 04</span></span><input type="text" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Example: Small business owners in India" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Keywords</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Signals / 05</span></span><input type="text" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Example: AI automation, productivity, small business" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
              </div>

              <label className="relative mt-5 block"><span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Topic or Content Brief</span><span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.16em] text-cyan-400/70"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Prompt channel / 06</span></span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Write an Instagram caption for a luxury watch brand launching a new collection." className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>

              <button type="button" onClick={handleGenerateContent} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-red-500/15 bg-slate-950/80 text-slate-400" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="M4 3h9l3 3v11H4zM13 3v4h3M7 10h6M7 13h5"/></svg>}{loading ? "Generating Content Intelligence..." : "Generate Content"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
              {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Content synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
              {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-950/25 p-4 text-sm text-red-200"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-red-400/40 text-[10px] font-bold">!</span><span>{error}</span></div>}
            </section>

            {content && (
              <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
                <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/><div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
                <div className="relative mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] pb-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M5 3h10l4 4v14H5z"/><path d="M8 12h8M8 16h6"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Content output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Content</h2></div></div><div className="flex flex-wrap gap-2.5"><button type="button" onClick={handleCopyContent} className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Content</button><button type="button" onClick={handleDownloadPDF} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button><button type="button" onClick={handleGenerateContent} disabled={loading} className="group flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:rotate-180" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button></div></div>
                <div className="relative mb-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Type <span className="ml-1 text-cyan-300">{contentType}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tone <span className="ml-1 text-cyan-300">{tone}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Length <span className="ml-1 text-cyan-300">{length}</span></span></div>
                <article className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/70 p-5 transition-all hover:border-red-400/30 hover:shadow-[0_0_24px_rgba(239,68,68,0.07)] sm:p-6"><div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/55 to-transparent"/><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/[0.06] font-mono text-[9px] font-bold text-red-300">01</span><div><span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-400/75"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Content intelligence module</span><h3 className="mt-0.5 text-sm font-semibold text-white">Generated Copy</h3></div></div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-300">{content}</pre></article>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ContentAIPage() {
  return <Suspense fallback={null}><ContentAIPageContent /></Suspense>;
}
