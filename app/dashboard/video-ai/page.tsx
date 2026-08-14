"use client";

import { Suspense, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";

function VideoAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [duration, setDuration] = useState("4 seconds");
  const [videoType, setVideoType] = useState("Promo Video");
const [scene, setScene] = useState("");
const [cameraMovement, setCameraMovement] = useState("Slow cinematic push-in");
const [lighting, setLighting] = useState("Cinematic studio lighting");
const [importantDetails, setImportantDetails] = useState("");
const [negativePrompt, setNegativePrompt] = useState(
  "No text, no watermark, no distortion, no extra objects"
);
const [colorPalette, setColorPalette] = useState("");
const [aspectRatio, setAspectRatio] = useState("Landscape (16:9)");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
  if (!projectId) return;

  // Clear data from the previously opened project.
  setPrompt("");
  setVideoUrl("");
  setError("");

  // Wait for this exact database project to load.
  if (!project || project.id !== projectId) return;

  // Temporary Video AI prompt handoff.
  const savedPrompt = localStorage.getItem("easy-platform-video-prompt");

  if (savedPrompt) {
    setPrompt(savedPrompt);
    localStorage.removeItem("easy-platform-video-prompt");
  }
}, [projectId, project]);

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      alert("Please enter a video description.");
      return;
    }

    setLoading(true);
    setError("");
    setVideoUrl("");

    try {
      const response = await fetch("/api/video-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  prompt,
  videoType,
  scene,
  cameraMovement,
  lighting,
  importantDetails,
  negativePrompt,
  colorPalette,
  style,
  duration,
  aspectRatio,
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
        throw new Error(errorText || "Video generation failed.");
      }

      const videoBlob = await response.blob();

if (!videoBlob.size) {
  throw new Error("No video was returned.");
}


const generatedVideoUrl = URL.createObjectURL(videoBlob);

setVideoUrl((previousUrl) => {
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }

  return generatedVideoUrl;
});
    } catch (err) {
      console.error("Video generation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the video."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "easy-platform-video.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert("Unable to download the video.");
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
          <div className="mx-auto max-w-6xl">
            <header className="relative mb-9 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2zM9 9l4 3-4 3z"/></svg><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/></div>
              <div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Motion Intelligence</span></div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Video Intelligence</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Direct cinematic AI video production through a precision motion-generation system.</p></div>
            </header>

            <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/><div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15"/>
              <div className="relative flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Motion Generation Matrix</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Configure the production sequence</h2><p className="mt-1 text-xs leading-5 text-slate-500">Set composition, movement, visual treatment and output format.</p></div><div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="M3 6h14M3 10h14M3 14h14"/><circle cx="7" cy="6" r="1.5" fill="currentColor"/><circle cx="13" cy="10" r="1.5" fill="currentColor"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/></svg></div></div>

              <div className="relative mt-6 grid gap-5 md:grid-cols-2">
                <label className="group/type block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Video Type</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Format / 01</span></span><span className="relative block"><select value={videoType} onChange={(e) => setVideoType(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Promo Video</option><option>Explainer</option><option>Product Video</option><option>Reel</option><option>Short</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/type:border-red-400/35 group-focus-within/type:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Scene / Background</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Scene / 02</span></span><input type="text" value={scene} onChange={(e) => setScene(e.target.value)} placeholder="Example: Black reflective studio background" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Camera Movement</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Motion / 03</span></span><input type="text" value={cameraMovement} onChange={(e) => setCameraMovement(e.target.value)} placeholder="Example: Slow cinematic push-in" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Lighting</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Light / 04</span></span><input type="text" value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="Example: Soft cinematic studio lighting" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Important Details</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Detail / 05</span></span><textarea value={importantDetails} onChange={(e) => setImportantDetails(e.target.value)} placeholder="Example: Ultra realistic ruby, 18K gold, macro shot, sparkling reflections, luxury advertisement, shallow depth of field" className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Negative Prompt</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Exclude / 06</span></span><textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="Example: blurry, watermark, extra fingers, low quality, text, logo, distortion" className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>
                <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Colour Palette</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Colour / 07</span></span><input type="text" value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} placeholder="Example: Gold, Black, Ruby Red" className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>

                <label className="group/style block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Video Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Render / 08</span></span><span className="relative block"><select value={style} onChange={(e) => setStyle(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Cinematic</option><option>Realistic</option><option>Anime</option><option>3D Animation</option><option>Commercial</option><option>Documentary</option><option>Luxury</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/style:border-red-400/35 group-focus-within/style:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/duration block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Duration</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Time / 09</span></span><span className="relative block"><select value={duration} onChange={(e) => setDuration(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>4 seconds</option><option>8 seconds</option><option>12 seconds</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/duration:border-red-400/35 group-focus-within/duration:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="group/aspect block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Aspect Ratio</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Canvas / 10</span></span><span className="relative block"><select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Landscape (16:9)</option><option>Portrait (9:16)</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/aspect:border-red-400/35 group-focus-within/aspect:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>
                <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Video Description</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Prompt / 11</span></span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: A futuristic city at night with flying cars and neon lights..." className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]"/></label>
              </div>

              <button type="button" onClick={handleGenerateVideo} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-red-500/15 bg-slate-950/80 text-slate-400" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>{loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="M4 5h9v10H4zM13 8l3-2v8l-3-2z"/></svg>}{loading ? "Generating Motion Intelligence..." : "Generate Video"}{!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}</button>
              {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Motion synthesis active</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300"/></div></div>}
              {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-950/25 p-4 text-sm text-red-200"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-red-400/40 text-[10px] font-bold">!</span><span>{error}</span></div>}
            </section>

            {videoUrl && (
              <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
                <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]"/><div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl"/>
                <div className="relative mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] pb-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Video output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Video</h2></div></div><div className="flex flex-wrap gap-2.5"><button type="button" onClick={handleGenerateVideo} className="group flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:rotate-180" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button><button type="button" onClick={handleDownloadVideo} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Video</button></div></div>
                <div className="relative mb-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Style <span className="ml-1 text-cyan-300">{style}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Duration <span className="ml-1 text-cyan-300">{duration}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Aspect <span className="ml-1 text-cyan-300">{aspectRatio}</span></span><span className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-red-300">Generation complete</span></div>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black p-2 shadow-[inset_0_0_30px_rgba(0,0,0,0.5),0_0_28px_rgba(239,68,68,0.06)]"><div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"/><video src={videoUrl} controls className="mx-auto max-h-[700px] w-full rounded-xl"/></div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function VideoAIPage() {
  return <Suspense fallback={null}><VideoAIPageContent /></Suspense>;
}
