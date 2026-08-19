"use client";

import { Suspense, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";
import auth from "../../lib/auth";

function ImageAIPageContent() {
  const { project, projectId } = useProjectMemory();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Realistic");
  const [size, setSize] = useState("Square");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
  if (!projectId) return;

  // Clear data from the previously opened project.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setPrompt("");
  setStyle("Realistic");
  setSize("Square");
  setImageUrl("");
  setError("");

  // Wait for this exact database project to load.
  if (!project || project.id !== projectId) return;

  // Temporary Creative AI prompt handoff.
  const savedPrompt = localStorage.getItem(
    "easy-platform-creative-prompt"
  );

  if (savedPrompt) {
    setPrompt(savedPrompt);
    localStorage.removeItem("easy-platform-creative-prompt");
  }
}, [projectId, project]);
  const handleGenerateImage = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    setError("Please log in first.");
    return;
  }

  if (!projectId) {
    setError("Please open a project before generating an image.");
    return;
  }

  if (!prompt.trim()) {
    alert("Please enter an image description.");
    return;
  }

  setLoading(true);
  setError("");

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/image-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
  prompt,
  style,
  size,
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

      throw new Error(
        errorText || "Image generation failed."
      );
    }

    const imageBlob = await response.blob();

console.log("Image type:", imageBlob.type);
console.log("Image size:", imageBlob.size);

if (imageBlob.size === 0) {
  throw new Error("No image was returned.");
}


if (!imageBlob.type.startsWith("image/")) {
  const errorText = await imageBlob.text();
  throw new Error(errorText || "The response was not a valid image.");
}

    const newImageUrl = URL.createObjectURL(imageBlob);

    setImageUrl((oldImageUrl) => {
      if (oldImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(oldImageUrl);
      }

      return newImageUrl;
    });
  } catch (err) {
    console.error("Image generation error:", err);

    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong while generating the image."
    );
  } finally {
    setLoading(false);
  }
};

  const handleDownloadImage = async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "buzypeezy-image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert("Unable to download the image.");
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

          <div className="relative mx-auto max-w-6xl">
            <header className="mb-9 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Visual Generation</span></div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Image Intelligence</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Generate professional AI images from a precise visual description.</p>
              </div>
            </header>

            <section className="group relative overflow-hidden rounded-[26px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-red-500/10 blur-3xl transition-colors duration-500 group-hover:bg-red-500/15" />

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">Generation Input</span><span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-300">System ready</span></div><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Define the visual objective</h2><p className="mt-1 text-xs leading-5 text-slate-500">Describe the subject, composition, environment and lighting.</p></div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-slate-950/70 text-red-300 sm:flex"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.4"><path d="m10 2 1.7 5.3L17 9l-5.3 1.7L10 16l-1.7-5.3L3 9l5.3-1.7L10 2Z"/></svg></div>
              </div>

              <label className="relative mt-6 block">
                <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Image Prompt</span><span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.16em] text-cyan-400/70"><span className="h-1 w-1 rounded-full bg-cyan-300"/>Prompt channel / 01</span></span>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: A luxury perfume bottle on black marble with cinematic lighting..." className="min-h-40 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_24px_rgba(239,68,68,0.1)]" />
              </label>

              <div className="relative mt-5 grid gap-5 md:grid-cols-2">
                <label className="group/style block">
                  <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Image Style</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Render / 02</span></span>
                  <span className="relative block">
                    <select value={style} onChange={(event) => setStyle(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                      <option>Realistic</option><option>Cinematic</option><option>3D Render</option><option>Digital Art</option><option>Minimal</option><option>Luxury</option><option>Illustration</option><option>Anime</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 transition-colors group-focus-within/style:border-red-400/35 group-focus-within/style:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span>
                  </span>
                </label>

                <label className="group/size block">
                  <span className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Image Size</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Canvas / 03</span></span>
                  <span className="relative block">
                    <select value={size} onChange={(event) => setSize(event.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                      <option>Square</option><option>Landscape</option><option>Portrait</option>
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 transition-colors group-focus-within/size:border-red-400/35 group-focus-within/size:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span>
                  </span>
                </label>
              </div>

              <button type="button" onClick={handleGenerateImage} disabled={loading} className={`group/button relative mt-6 flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loading ? "cursor-not-allowed border-red-500/15 bg-slate-950/80 text-slate-400" : "border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(239,68,68,0.1)] hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)]"}`}>
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300/25 border-t-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.25)]"/> : <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-200" strokeWidth="1.5"><path d="m10 2 1.7 5.3L17 9l-5.3 1.7L10 16l-1.7-5.3L3 9l5.3-1.7L10 2Z"/></svg>}
                {loading ? "Generating Image..." : "Generate Image"}
                {!loading && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover/button:translate-x-1" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4"/></svg>}
              </button>

              {loading && <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/10 bg-slate-950/55 p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.18em]"><span className="text-cyan-300">Rendering visual intelligence</span><span className="text-slate-600">Processing</span></div><div className="h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-300 shadow-[0_0_10px_rgba(239,68,68,0.3)]"/></div></div>}

              {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-950/25 p-4 text-sm text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.06)]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-red-400/40 text-[10px] font-bold">!</span><span>{error}</span></div>}
            </section>

            {imageUrl && (
              <section className="relative mt-8 overflow-hidden rounded-[26px] border border-red-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.08)] sm:p-7">
                <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/80 to-transparent shadow-[0_0_14px_rgba(239,68,68,0.35)]" />
                <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-red-500/10 blur-3xl" />

                <div className="relative mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-white/[0.06] pb-6">
                  <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/35 bg-slate-950/80 text-red-300 shadow-[0_0_22px_rgba(239,68,68,0.12)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg></div><div><div className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Image output / ready</span></div><h2 className="text-2xl font-bold tracking-tight text-white">Generated Image</h2></div></div>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={handleGenerateImage} className="group flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/20 bg-slate-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300 transition-transform duration-300 group-hover:rotate-180" strokeWidth="1.5"><path d="M15.5 7A6 6 0 1 0 16 12"/><path d="M12.5 4.5H16V8"/></svg>Regenerate</button>
                    <button type="button" onClick={handleDownloadImage} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Image</button>
                  </div>
                </div>

                <div className="relative mb-4 flex flex-wrap gap-2"><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Style <span className="ml-1 text-cyan-300">{style}</span></span><span className="rounded-lg border border-white/[0.07] bg-slate-950/60 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Canvas <span className="ml-1 text-cyan-300">{size}</span></span><span className="rounded-lg border border-red-500/15 bg-red-500/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-red-300">Generation complete</span></div>
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#05070b] p-2 shadow-[inset_0_0_30px_rgba(0,0,0,0.5),0_0_28px_rgba(239,68,68,0.06)]"><div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"/><img src={imageUrl} alt="AI generated result" className="mx-auto max-h-[700px] w-full rounded-xl object-contain" /></div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ImageAIPage() {
  return <Suspense fallback={null}><ImageAIPageContent /></Suspense>;
}
