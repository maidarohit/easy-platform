"use client";

import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { useProjectMemory } from "../hooks/useProjectMemory";

type UiuxResult = {
  accessibility: string;
  colourScheme?: string;
  designSystem: string;
  desktopExperience: string;
  microInteractions: string;
  mobileExperience: string;
  uiuxStrategy: string;
  userFlow: string;
  userPersonas: string;
  wireframes: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function UIUXAIPageContent() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [uiuxGoal, setUiuxGoal] = useState("Improve User Experience");
  const [brandStyle, setBrandStyle] = useState("Minimal");
  const [brandDescription, setBrandDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandResult, setBrandResult] = useState<UiuxResult | null>(null);
  const { project, projectId } = useProjectMemory();

  useEffect(() => {
  if (!projectId) return;

  // Prevent results/fields from the previous project appearing.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset stale project data when the selected project changes
  setBrandResult(null);
  setCompanyName("");
  setIndustry("");
  setTargetAudience("");
  setBrandDescription("");

  // Wait until memory for this exact project has loaded.
  if (!project || project.id !== projectId) return;

  setCompanyName(project.companyName || "");
  setIndustry(project.industry || "");
  setTargetAudience(project.targetAudience || "");
  setBrandDescription(
    project.businessDescription || project.originalBrief || ""
  );
}, [projectId, project]);
useEffect(() => {
  if (!projectId || !project?.userId) return;

  let active = true;

  const loadSavedUIUXOutput = async () => {
    try {
      const response = await authenticatedFetch(
        `/api/project-outputs?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(project.userId)}&module=uiux`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load UI/UX AI output");
      }

      if (!active || !data.output?.result) return;

      const savedResult =
        typeof data.output.result === "string"
          ? JSON.parse(data.output.result)
          : data.output.result;

      setBrandResult(savedResult);
    } catch (error) {
      console.error("Failed to restore UI/UX AI output:", error);
    }
  };

  loadSavedUIUXOutput();

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
  const copyEntireSEO = () => {
    if (!brandResult) return;

    const content = `
🎨 UI/UX Strategy:
${brandResult.uiuxStrategy}

👥 User Personas:
${brandResult.userPersonas}

🗺️ User Flow:
${brandResult.userFlow}

🧩 Wireframes:
${brandResult.wireframes}

🎨 Design System:
${brandResult.designSystem}

📱 Mobile Experience:
${brandResult.mobileExperience}

🖥️ Desktop Experience:
${brandResult.desktopExperience}


✨ Micro Interactions:
${brandResult.microInteractions}

♿ Accessibility:
${brandResult.accessibility}
`;

    navigator.clipboard.writeText(content);
    toast.success("SEO Plan copied!");
  };
  const continueToSales = () => {
  if (!brandResult) {
    toast.error("Generate the UI/UX plan first.");
    return;
  }

  localStorage.setItem(
    "easy-platform-open-sales-project",
    JSON.stringify({
      companyName,
      industry,
      targetAudience: targetAudience || brandResult?.userPersonas || "",
      salesGoal: uiuxGoal || "Increase Revenue",
      businessDescription: brandDescription,
      uiuxResult: brandResult,
    })
  );

  window.location.href = "/sales-ai";
};
  
  const downloadPDF = () => {
    if (!brandResult) return;

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("UI/UX Strategy Report", 20, 20);

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

    addSection("UI/UX Strategy", brandResult.uiuxStrategy);
addSection("User Personas", brandResult.userPersonas);
addSection("User Flow", brandResult.userFlow);
addSection("Wireframes", brandResult.wireframes);
addSection("Design System", brandResult.designSystem);
addSection("Mobile Experience", brandResult.mobileExperience);
addSection("Desktop Experience", brandResult.desktopExperience);
addSection("Micro Interactions", brandResult.microInteractions);
addSection("Accessibility", brandResult.accessibility);

    doc.save(`${companyName}-UIUX-Strategy.pdf`);

    toast.success("PDF downloaded!");
  };
  const handleGenerateBrand = async () => {
    if (
  !companyName ||
  !industry ||
  !uiuxGoal ||
  !brandDescription
) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast.error("Please log in first.");
      return;
    }

    if (!projectId) {
      toast.error("Please open a project before generating UI/UX intelligence.");
      return;
    }

    setLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/uiux-ai", {
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
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const text = await response.text();

      console.log("RAW RESPONSE:", text);
      console.log("STATUS:", response.status);

      if (!text.trim()) {
        throw new Error("n8n returned EMPTY response");
      }

      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      console.log("PARSED:", parsed);

      let result: unknown = parsed;

while (true) {
  if (typeof result === "string") {
    result = JSON.parse(result);
    continue;
  }

  if (
    isRecord(result) &&
    "text" in result &&
    typeof result.text === "object"
  ) {
    result = result.text;
    continue;
  }

  if (
  isRecord(result) &&
  "output" in result
) {
  if (typeof result.output === "string") {
    result = JSON.parse(result.output);
  } else {
    result = result.output;
  }
  continue;
}


  break;
}


if (!isRecord(result)) {
  throw new Error("UI/UX AI returned an invalid response.");
}

setBrandResult(result as UiuxResult);
if (projectId && project?.userId && result) {
  const saveOutputResponse = await authenticatedFetch("/api/project-outputs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      userId: project.userId,
      module: "uiux",
      result,
    }),
  });

  if (!saveOutputResponse.ok) {
    console.error("Failed to save UI/UX AI output");
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
    setUiuxGoal("Improve User Experience");
    setBrandStyle("Minimal");
    setBrandDescription("");
    setBrandResult(null);
  };
  const fieldClass = "w-full rounded-xl border border-slate-700/70 bg-[#070b16]/90 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-red-500/30 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10";
  const selectClass = `${fieldClass} appearance-none pr-11`;
  const labelClass = "mb-2 flex items-center justify-between text-sm font-medium text-white";
  const codeClass = "text-[9px] font-semibold tracking-[0.2em] text-cyan-400/70";
  const resultCardClass = "relative mt-5 overflow-hidden rounded-[24px] border border-red-500/15 bg-slate-950/65 p-5 shadow-[0_0_35px_rgba(239,68,68,0.04)] transition hover:border-red-400/30 hover:shadow-[0_0_40px_rgba(239,68,68,0.08)] sm:p-7";
  const resultCopyClass = "shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10";
  const resultBodyClass = "mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300";
  const moduleLabelClass = "text-[9px] font-semibold uppercase tracking-[0.22em] text-red-300";
  const moduleChipClass = "rounded-full border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-cyan-300";
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
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="relative h-7 w-7"><path d="M4 5.5h16v13H4zM8 9h8M8 13h5"/><circle cx="17.5" cy="16" r="1.5"/></svg>
                <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              </div>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300">Experience Intelligence</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">UI/UX Intelligence</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">Engineer intuitive digital experiences, user journeys, interface systems, accessibility standards and conversion-focused interaction design through one intelligent experience engine.</p></div>
            </div>
            <button onClick={resetStrategy} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>New UI/UX Strategy</button>
          </header>

          <div className="relative mt-10 overflow-hidden rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 shadow-[0_0_60px_rgba(239,68,68,0.07)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
            <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-red-300">UI/UX Generation Matrix</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Configure the experience brief</h2><p className="mt-2 text-sm leading-6 text-slate-500">Define the product context, user objective, interface direction and experience requirements.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_7px_#22d3ee]" />System Ready</span></div>
            <div className="mt-7 grid gap-6 md:grid-cols-2">

            {/* Business Name */}

            <div>
              <label className={labelClass}>
                <span>Business Name</span><span className={codeClass}>IDENTITY / 01</span>
              </label>

              <input
                type="text"
                placeholder="Example: Easy Platform"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={fieldClass}
              />
            </div>

            {/* Industry */}

            <div>
              <label className={labelClass}>
                <span>Industry</span><span className={codeClass}>SECTOR / 02</span>
              </label>

              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={selectClass}
              >
                <option value="">Select Industry</option>
                <option>AI & Technology</option>
                <option>Digital Marketing</option>
                <option>Healthcare</option>
                <option>Finance</option>
                <option>Education</option>
                <option>Real Estate</option>
                <option>E-commerce</option>
                <option>Interior Design</option>
                <option>Food & Beverage</option>
                <option>Legal</option>
                <option>Manufacturing</option>
                <option>Other</option>
              </select>
            </div>

            {/* Website Goal */}

            <div>
              <label className={labelClass}>
                <span>UI/UX Goal</span><span className={codeClass}>OBJECTIVE / 03</span>
              </label>

              <select
                value={uiuxGoal}
onChange={(e) => setUiuxGoal(e.target.value)}
                className={selectClass}
              >
                <option value="">Select UI/UX Goal</option>
                {uiuxGoal &&
  ![
    "Improve User Experience",
    "Create Mobile App UI",
    "Design Website Interface",
    "Build Design System",
    "Increase Conversion Rate",
    "Improve Accessibility",
    "Create Dashboard UI",
    "Design Landing Page",
    "Redesign Existing Product",
    "Other",
  ].includes(uiuxGoal) && (
    <option value={uiuxGoal}>{uiuxGoal}</option>
  )}
                <option>Improve User Experience</option>
<option>Create Mobile App UI</option>
<option>Design Website Interface</option>
<option>Build Design System</option>
<option>Increase Conversion Rate</option>
<option>Improve Accessibility</option>
<option>Create Dashboard UI</option>
<option>Design Landing Page</option>
<option>Redesign Existing Product</option>
<option>Other</option>
              </select>
            </div>

            {/* Design Style */}

            <div>
              <label className={labelClass}>
                <span>Design Style</span><span className={codeClass}>AESTHETIC / 04</span>
              </label>

              <select
                value={brandStyle}
                onChange={(e) => setBrandStyle(e.target.value)}
                className={selectClass}
              >
                <option>Modern</option>
<option>Minimal</option>
<option>Corporate</option>
<option>Luxury</option>
<option>Playful</option>
<option>Dark Mode</option>
<option>Light Mode</option>
<option>Glassmorphism</option>
<option>Neumorphism</option>
<option>Material Design</option>
              </select>
            </div>

            {/* Project Description */}

            <div className="md:col-span-2">
              <label className={labelClass}>
                <span>Project Description</span><span className={codeClass}>CONTEXT / 05</span>
              </label>

              <textarea
                rows={5}
                placeholder="Describe your project, target users, business goals, preferred design style, required screens, features, pain points, and any UI/UX requirements..."
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                className={`${fieldClass} resize-y`}
              />
            </div>
            </div>

            <button
              onClick={handleGenerateBrand}
              disabled={loading}
              className={`mt-7 flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-sm font-bold uppercase tracking-[0.12em] transition sm:px-7 ${loading
                ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500"
                : "border-red-500/40 bg-gradient-to-r from-red-600 via-red-700 to-[#090c15] text-white shadow-[0_0_30px_rgba(239,68,68,0.18)] hover:border-red-400/70 hover:shadow-[0_0_40px_rgba(239,68,68,0.28)]"
                }`}
            >
              <span>{loading ? "Generating UI/UX Intelligence..." : "Generate UI/UX Intelligence"}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">→</span>
            </button>
            </div>
            {!brandResult && (
              <section className="mt-8 rounded-[28px] border border-dashed border-red-500/20 bg-slate-950/45 px-6 py-14 text-center sm:px-10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6"><path d="M4 6h16v12H4zM8 10h8M8 14h5" /></svg></div>
                <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Experience Output / Standby</p>
                <h2 className="mt-3 text-2xl font-semibold">Your UI/UX Intelligence will appear here</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">Configure the experience brief to generate user journeys, interface architecture, wireframe direction, design systems, accessibility recommendations and conversion-focused UX improvements.</p>
              </section>
            )}
            {brandResult && (
              <div className="mt-8">
                <div className="mb-6 flex flex-col gap-5 rounded-[28px] border border-red-500/20 bg-slate-950/70 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Experience Output / Ready</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Generated UI/UX Intelligence</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                  <button
                    onClick={copyEntireSEO}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
                  >
                    Copy Entire UI/UX Strategy
                  </button>
                  <button
                    onClick={downloadPDF}
                    className="rounded-xl border border-red-400/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-200 transition hover:border-red-300/40 hover:bg-red-500/10"
                  >
                    Download PDF
                  </button>
                  <button onClick={handleGenerateBrand} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-red-500/30 hover:text-white">Regenerate</button>
                  <button
  onClick={continueToSales}
  className="rounded-xl border border-cyan-400/15 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200"
>
  Continue to Sales AI →
</button>
                  </div>
                </div>

                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 01</span><span className={moduleChipClass}>Strategy</span></span><span className="mt-2 block text-xl font-semibold text-white">UI/UX Strategy</span>
                    </h2>

                    <button
                      onClick={() =>
                        copyToClipboard(
                          brandResult.uiuxStrategy,
                          "UI/UX Strategy"
                        )
                      }
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.uiuxStrategy}
                  </p>
                </div>
                <div className={resultCardClass}>

                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 02</span><span className={moduleChipClass}>Audience</span></span><span className="mt-2 block text-xl font-semibold text-white">User Personas</span>
                    </h2>

                    <button
                      onClick={() =>
                        copyToClipboard(
                          brandResult.userPersonas,
                          "User Personas"
                        )
                      }
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.userPersonas}
                  </p>

                </div>
                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 03</span><span className={moduleChipClass}>Journey</span></span><span className="mt-2 block text-xl font-semibold text-white">User Flow</span>
                    </h2>

                    <button
                      onClick={() => copyToClipboard(
                        brandResult.userFlow,
                        "User Flow"
                      )}
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.userFlow}
                  </p>
                </div>
                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 04</span><span className={moduleChipClass}>Wireframe</span></span><span className="mt-2 block text-xl font-semibold text-white">Wireframes</span>
                    </h2>

                    <button
                      onClick={() =>
                        copyToClipboard(
                          brandResult.wireframes,
                          "Wireframes"
                        )
                      }
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.wireframes}
                  </p>
                </div>
                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 05</span><span className={moduleChipClass}>Design System</span></span><span className="mt-2 block text-xl font-semibold text-white">Design System</span>
                    </h2>

                    <button
                      onClick={() =>
                        copyToClipboard(
                          brandResult.designSystem,
                           "Design System"
                        )
                      }
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.designSystem}
                  </p>
                </div>
                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 06</span><span className={moduleChipClass}>Mobile</span></span><span className="mt-2 block text-xl font-semibold text-white">Mobile Experience</span>
                    </h2>

                    <button
                      onClick={() => copyToClipboard(brandResult.mobileExperience,  "Mobile Experience")}
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.mobileExperience}
                  </p>
                </div>
                <div className={resultCardClass}>
                  <div className="flex items-start justify-between gap-4">
                    <h2>
                      <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 07</span><span className={moduleChipClass}>Desktop</span></span><span className="mt-2 block text-xl font-semibold text-white">Desktop Experience</span>
                    </h2>

                    <button
                      onClick={() => copyToClipboard(brandResult.desktopExperience, "Desktop Experience")}
                      className={resultCopyClass}
                    >
                      Copy
                    </button>
                  </div>

                  <p className={resultBodyClass}>
                    {brandResult.desktopExperience}
                  </p>
                  </div>
                  
                  <div className={resultCardClass}>
                    <div className="flex items-start justify-between gap-4">
                      <h2>
                        <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 08</span><span className={moduleChipClass}>Interaction</span></span><span className="mt-2 block text-xl font-semibold text-white">Micro Interactions</span>
                      </h2>

                      <button
                        onClick={() => copyToClipboard(
                          brandResult.microInteractions,
                          "Micro Interactions"
                        )}
                        className={resultCopyClass}
                      >
                        Copy
                      </button>
                    </div>

                    <p className={resultBodyClass}>
                      {brandResult.microInteractions}
                    </p>
                  </div>
                  <div className={resultCardClass}>
                    <div className="flex items-start justify-between gap-4">
                      <h2>
                        <span className="flex flex-wrap items-center gap-2"><span className={moduleLabelClass}>Module / 09</span><span className={moduleChipClass}>Accessibility</span></span><span className="mt-2 block text-xl font-semibold text-white">Accessibility</span>
                      </h2>

                      <button
                        onClick={() =>
                          copyToClipboard(
                            brandResult.accessibility,
                            "Accessibility"
                          )
                        }
                        className={resultCopyClass}
                      >
                        Copy
                      </button>
                    </div>

                    <p className={resultBodyClass}>
                      {brandResult.accessibility}
                    </p>
                  </div>
                </div>
                )}

        </div>
      </section>
    </main>
  );
}

export default function UIUXAIPage() {
  return <Suspense fallback={null}><UIUXAIPageContent /></Suspense>;
}
