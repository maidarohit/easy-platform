"use client";

import jsPDF from "jspdf";
import { Suspense, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";
import auth from "../../lib/auth";

type PresentationSlide = {
  number: string;
  heading: string;
  contentLabel: string;
  content: string;
  visualLabel: string;
  visualSuggestion: string;
  notesLabel: string;
  speakerNotes: string;
};

const parsePresentationSlides = (value: string): PresentationSlide[] => {
  const headingPattern = /^Slide\s+(\d+)\s*(?:[:\-–—]\s*)?.*$/gim;
  const headings = Array.from(value.matchAll(headingPattern));

  if (headings.length === 0) return [];

  return headings.map((headingMatch, index) => {
    const start = headingMatch.index ?? 0;
    const end = headings[index + 1]?.index ?? value.length;
    const heading = headingMatch[0];
    const headingEnd = start + heading.length;
    const preamble = index === 0 ? value.slice(0, start) : "";
    const body = `${preamble}${value.slice(headingEnd, end)}`;
    const sectionPattern = /^(Content|Main Slide Content|Slide Content|Visual Suggestions?|Speaker Notes?)\s*:\s*/gim;
    const sections = Array.from(body.matchAll(sectionPattern));

    let content = sections.length > 0 ? body.slice(0, sections[0].index) : body;
    let contentLabel = "Slide Content";
    let visualSuggestion = "";
    let visualLabel = "Visual Suggestion";
    let speakerNotes = "";
    let notesLabel = "Speaker Notes";

    sections.forEach((section, sectionIndex) => {
      const sectionStart = (section.index ?? 0) + section[0].length;
      const sectionEnd = sections[sectionIndex + 1]?.index ?? body.length;
      const sectionValue = body.slice(sectionStart, sectionEnd);
      const label = section[1];

      if (/^Visual Suggestion/i.test(label)) {
        visualLabel = label;
        visualSuggestion = sectionValue;
      } else if (/^Speaker Notes/i.test(label)) {
        notesLabel = label;
        speakerNotes = sectionValue;
      } else {
        contentLabel = label;
        content += sectionValue;
      }
    });

    return {
      number: headingMatch[1],
      heading,
      contentLabel,
      content: content.trim(),
      visualLabel,
      visualSuggestion: visualSuggestion.trim(),
      notesLabel,
      speakerNotes: speakerNotes.trim(),
    };
  });
};

function PresentationAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [topic, setTopic] = useState("");
  const [presentationType, setPresentationType] =
    useState("Business Presentation");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Professional");
  const [slideCount, setSlideCount] = useState("8");
  const [keyPoints, setKeyPoints] = useState("");
  const [designStyle, setDesignStyle] = useState("Modern");
  const [presentation, setPresentation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
  if (!projectId) return;

  // Clear data from the previously opened project.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setTopic("");
  setPresentationType("Business Presentation");
  setAudience("");
  setTone("Professional");
  setSlideCount("8");
  setKeyPoints("");
  setDesignStyle("Modern");
  setPresentation("");
  setError("");

  // Wait for this exact database project to load.
  if (!project || project.id !== projectId) return;

  // Use saved audience only when one actually exists.
  setAudience(project.targetAudience || "");

  // Temporary Presentation AI prompt handoff.
  const savedPrompt = localStorage.getItem(
    "easy-platform-presentation-prompt"
  );

  if (savedPrompt) {
    setTopic(savedPrompt);
    localStorage.removeItem("easy-platform-presentation-prompt");
  }
}, [projectId, project]);

  const handleGeneratePresentation = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError("Please log in first.");
      return;
    }

    if (!projectId) {
      setError("Please open a project before generating a presentation.");
      return;
    }

    if (!topic.trim()) {
      setError("Please enter a presentation topic.");
      return;
    }

    setLoading(true);
    setError("");
    setPresentation("");

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/presentation-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
  topic,
  presentationType,
  audience,
  tone,
  slideCount,
  keyPoints,
  designStyle,
  projectId,
  projectContext: project
    ? {
        companyName: project.companyName,
        industry: project.industry,
        businessDescription: project.businessDescription,
        targetAudience: project.targetAudience,
        goal: project.goal,
        brandStyle: project.brandStyle,
      }
    : null,
}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Presentation generation failed.");
      }

      const data = await response.json();

      const generatedPresentation =
        data.presentation ||
        data.content ||
        data.output ||
        data.result ||
        data.text ||
        "";

      if (!generatedPresentation) {
        throw new Error("No presentation content was returned.");
      }

      setPresentation(
        typeof generatedPresentation === "string"
          ? generatedPresentation
          : JSON.stringify(generatedPresentation, null, 2)
      );
    } catch (err) {
      console.error("Presentation generation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the presentation."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPresentation = async () => {
    if (!presentation) return;

    try {
      await navigator.clipboard.writeText(presentation);
      alert("Presentation content copied successfully.");
    } catch {
      alert("Unable to copy the presentation.");
    }
  };

  const presentationSlides = parsePresentationSlides(presentation);

  const handleDownloadPDF = () => {
    if (!presentation) return;

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

    const addSection = (label: string, value: string) => {
      if (!value.trim()) return;
      ensureSpace(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(14, 94, 84);
      doc.text(label, margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 61);
      const lines = doc.splitTextToSize(value, maxWidth) as string[];
      for (const line of lines) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 6;
      }
      y += 5;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.setTextColor(14, 44, 36);
    doc.text("Presentation AI Deck", margin, y);
    y += 4;
    doc.setDrawColor(239, 112, 96);
    doc.setLineWidth(0.8);
    doc.line(margin, y, 190, y);
    y += 12;

    addSection("Presentation Topic", topic);
    addSection("Presentation Type", presentationType);
    addSection("Number of Slides", slideCount);
    addSection("Target Audience", audience);
    addSection("Tone", tone);
    addSection("Design Style", designStyle);

    if (presentationSlides.length === 0) {
      addSection("Generated Presentation", presentation);
    } else {
      presentationSlides.forEach((slide) => {
        doc.addPage();
        y = 20;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(239, 112, 96);
        doc.text(`SLIDE ${slide.number.padStart(2, "0")}`, margin, y);
        y += 8;

        doc.setFontSize(17);
        doc.setTextColor(14, 44, 36);
        const titleLines = doc.splitTextToSize(slide.heading, maxWidth) as string[];
        for (const line of titleLines) {
          ensureSpace(8);
          doc.text(line, margin, y);
          y += 8;
        }
        y += 5;

        addSection(slide.contentLabel || "Main Slide Content", slide.content);
        addSection(slide.visualLabel || "Visual Suggestion", slide.visualSuggestion);
        addSection(slide.notesLabel || "Speaker Notes", slide.speakerNotes);
      });
    }

    doc.save("Presentation-AI-Deck.pdf");
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
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M4 4h16v12H4zM8 20l4-4 4 4"/><path d="M8 12V9m4 3V7m4 5v-2"/></svg><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/></div>
              <div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Presentation Intelligence</span></div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Deck Intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Engineer professional slide-by-slide narratives with content, speaker notes and visual direction.</p></div>
            </header>

            <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/><div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
              <div className="relative flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Presentation Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the deck brief</h2><p className="mt-1 text-xs leading-5 text-slate-500">Define narrative, audience, delivery tone and visual system.</p></div><div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M3 5h14v10H3zM6 18l4-3 4 3"/><path d="M6 12V9m4 3V7m4 5v-2"/></svg></div></div>

              <label className="relative mt-6 block"><span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Presentation Topic</span><span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.16em] text-cyan-400/70"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Brief channel / 01</span></span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: Create an investor presentation for an AI automation platform for small businesses." className="min-h-36 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>

              <div className="relative mt-5 grid gap-5 md:grid-cols-2">
                <label className="group/type block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Presentation Type</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Format / 02</span></span><span className="relative block"><select value={presentationType} onChange={(event) => setPresentationType(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Business Presentation</option><option>Investor Pitch Deck</option><option>Sales Presentation</option><option>Marketing Presentation</option><option>Educational Presentation</option><option>Project Proposal</option><option>Company Profile</option><option>Product Launch</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/type:border-red-400/35 group-focus-within/type:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/count block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Number of Slides</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Length / 03</span></span><span className="relative block"><select value={slideCount} onChange={(event) => setSlideCount(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option value="5">5 Slides</option><option value="8">8 Slides</option><option value="10">10 Slides</option><option value="12">12 Slides</option><option value="15">15 Slides</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/count:border-red-400/35 group-focus-within/count:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Target Audience</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Audience / 04</span></span><input type="text" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Example: Investors and startup founders" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="group/tone block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Tone</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Voice / 05</span></span><span className="relative block"><select value={tone} onChange={(event) => setTone(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Professional</option><option>Persuasive</option><option>Informative</option><option>Inspirational</option><option>Luxury</option><option>Minimal</option><option>Bold</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/tone:border-red-400/35 group-focus-within/tone:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Important Points</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Narrative / 06</span></span><textarea value={keyPoints} onChange={(event) => setKeyPoints(event.target.value)} placeholder="Example: Market problem, platform solution, target customers, revenue model, competitive advantage and growth plan." className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="group/design block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Design Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Visual / 07</span></span><span className="relative block"><select value={designStyle} onChange={(event) => setDesignStyle(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Modern</option><option>Minimal</option><option>Corporate</option><option>Luxury</option><option>Futuristic</option><option>Creative</option><option>Dark Professional</option><option>Colourful</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/design:border-red-400/35 group-focus-within/design:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
              </div>

              <button type="button" onClick={handleGeneratePresentation} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-red-500/15 bg-slate-950/80 text-slate-400" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="M3 4h14v10H3zM7 17l3-3 3 3"/></svg>}{loading ? "Generating Presentation Intelligence..." : "Generate Presentation"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
              {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Deck synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
              {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-950/25 p-4 text-sm text-red-200"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-red-400/40 text-[10px] font-bold">!</span><span>{error}</span></div>}
            </section>

            {presentation && (
              <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
                <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/><div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
                <div className="relative mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] pb-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><path d="M4 4h16v12H4zM8 20l4-4 4 4"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Deck output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Presentation</h2></div></div><div className="flex flex-wrap gap-2.5"><button type="button" onClick={handleCopyPresentation} className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Presentation</button><button type="button" onClick={handleDownloadPDF} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-500/25 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-red-100 transition-all hover:-translate-y-0.5 hover:border-red-400/50 hover:bg-red-500/10 hover:shadow-[0_0_20px_rgba(239,68,68,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download PDF</button><button type="button" onClick={handleGeneratePresentation} disabled={loading} className="group flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:rotate-180" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button></div></div>
                <div className="relative mb-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Type <span className="ml-1 text-cyan-300">{presentationType}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Slides <span className="ml-1 text-cyan-300">{slideCount}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Design <span className="ml-1 text-cyan-300">{designStyle}</span></span></div>
                {presentationSlides.length > 0 ? (
                  <div className="relative space-y-4">
                    {presentationSlides.map((slide, index) => (
                      <details key={`${slide.number}-${index}`} className="group/slide relative overflow-hidden rounded-2xl border border-[#D8E3DD] bg-[#FCFBF7] shadow-[0_10px_30px_rgba(14,44,36,0.08)] transition-all duration-300 open:border-[#F0A094] open:shadow-[0_16px_36px_rgba(14,44,36,0.12)] hover:border-[#9FCBC4]">
                        <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#EF7060] via-[#65BFB4] to-[#EF7060] opacity-70 transition-opacity group-open/slide:opacity-100" />
                        <summary className="relative flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/40 sm:px-5 [&::-webkit-details-marker]:hidden">
                          <div className="flex min-w-0 items-center gap-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#F0A094] bg-[#FFF0EC] font-mono text-[10px] font-bold tracking-wider text-[#B94639] shadow-[0_6px_16px_rgba(239,112,96,0.12)]">{slide.number.padStart(2, "0")}</span>
                            <div className="min-w-0"><span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#0E766E]"><span className="h-1 w-1 rounded-full bg-[#45AFA4]"/>Deck intelligence module</span><h3 className="mt-1 truncate text-sm font-semibold text-[#0E2C24] sm:text-base">{slide.heading}</h3></div>
                          </div>
                          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#BCD3CC] bg-white text-[#35685E] transition-all group-open/slide:rotate-45 group-open/slide:border-[#65BFB4] group-open/slide:bg-[#EAF7F4] group-open/slide:text-[#0E766E]"><span className="absolute h-px w-3 bg-current"/><span className="absolute h-3 w-px bg-current"/></span>
                        </summary>

                        <div className="relative border-t border-[#DCE7E1] bg-white/70 px-4 py-5 sm:px-6 sm:py-6">
                          {slide.content && <section><h4 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B94639]">{slide.contentLabel}</h4><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-[#3F4B46]">{slide.content}</pre></section>}
                          {(slide.visualSuggestion || slide.speakerNotes) && (
                            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                              {slide.visualSuggestion && <section className="rounded-xl border border-[#B9DDD7] bg-[#EDF8F5] p-4"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#45AFA4]"/><h4 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#0E766E]">{slide.visualLabel}</h4></div><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-[#3F4B46]">{slide.visualSuggestion}</pre></section>}
                              {slide.speakerNotes && <section className="rounded-xl border border-[#F2C1B9] bg-[#FFF3F0] p-4"><div className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-[#C65345]" strokeWidth="1.4"><path d="M3 3h10v8H7l-3 2v-2H3z"/></svg><h4 className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B94639]">{slide.notesLabel}</h4></div><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-[#3F4B46]">{slide.speakerNotes}</pre></section>}
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <article className="group relative overflow-hidden rounded-2xl border border-[#D8E3DD] bg-[#FCFBF7] p-5 text-[#3F4B46] shadow-[0_10px_30px_rgba(14,44,36,0.08)] transition-all hover:border-[#9FCBC4] hover:shadow-[0_16px_36px_rgba(14,44,36,0.12)] sm:p-6"><div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#EF7060] via-[#65BFB4] to-[#EF7060]"/><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#F0A094] bg-[#FFF0EC] font-mono text-[9px] font-bold text-[#B94639]">01</span><div><span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#0E766E]"><span className="h-1 w-1 rounded-full bg-[#45AFA4]"/>Deck intelligence module</span><h3 className="mt-0.5 text-sm font-semibold text-[#0E2C24]">Presentation Content</h3></div></div><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[#3F4B46]">{presentation}</pre></article>
                )}
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function PresentationAIPage() {
  return <Suspense fallback={null}><PresentationAIPageContent /></Suspense>;
}
