"use client";

import { Suspense, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useProjectMemory } from "../../hooks/useProjectMemory";

type AutomationType =
  | "content"
  | "email"
  | "social"
  | "workflow"
  | "pipeline";

function AutomationPageContent() {
  const { project, projectId } = useProjectMemory();
  const [selectedType, setSelectedType] =
    useState<AutomationType>("content");
    const [businessName, setBusinessName] = useState("");
const [contentType, setContentType] = useState("Blog");
const [targetAudience, setTargetAudience] = useState("");
const [tone, setTone] = useState("Professional");
const [topic, setTopic] = useState("");
const [instructions, setInstructions] = useState("");
const [loading, setLoading] = useState(false);
const [result, setResult] = useState("");
const [error, setError] = useState("");
const [emailBusinessName, setEmailBusinessName] = useState("");
const [emailAudience, setEmailAudience] = useState("");
const [emailType, setEmailType] = useState("Campaign");
const [emailTone, setEmailTone] = useState("Professional");
const [emailSubject, setEmailSubject] = useState("");
const [emailMessage, setEmailMessage] = useState("");
const [emailCta, setEmailCta] = useState("");
const [emailInstructions, setEmailInstructions] = useState("");
const [platform, setPlatform] = useState("Instagram");
const [postType, setPostType] = useState("Promotional Post");
const [emailLoading, setEmailLoading] = useState(false);
const [emailResult, setEmailResult] = useState("");
const [emailError, setEmailError] = useState("");
const [workflowName, setWorkflowName] = useState("");
const [automationGoal, setAutomationGoal] = useState("");
const [workflowTrigger, setWorkflowTrigger] = useState("");
const [workflowSteps, setWorkflowSteps] = useState("");
const [workflowInstructions, setWorkflowInstructions] = useState("");
const [workflowLoading, setWorkflowLoading] = useState(false);
const [workflowResult, setWorkflowResult] = useState("");
const [workflowError, setWorkflowError] = useState("");
useEffect(() => {
  if (!projectId) return;

  // Clear data/results from the previously opened project.
  setBusinessName("");
  setTargetAudience("");
  setEmailBusinessName("");
  setEmailAudience("");
  setResult("");
  setEmailResult("");
  setWorkflowResult("");
  setError("");
  setEmailError("");
  setWorkflowError("");

  // Wait for this exact database project to load.
  if (!project || project.id !== projectId) return;

  // Load only real saved Project Memory values.
  setBusinessName(project.companyName || "");
  setTargetAudience(project.targetAudience || "");
  setEmailBusinessName(project.companyName || "");
  setEmailAudience(project.targetAudience || "");

  // Temporary Social AI draft handoff.
  const savedPrompt = localStorage.getItem(
    "easy-platform-social-prompt"
  );

  if (savedPrompt) {
    setTopic(savedPrompt);
    setSelectedType("social");
    localStorage.removeItem("easy-platform-social-prompt");
  }
}, [projectId, project]);
const handleRunContentAutomation = async () => {
  if (!topic.trim()) {
    setError("Please enter a topic or content brief.");
    return;
  }

  setLoading(true);
  setError("");
  setResult("");

  try {
    const response = await fetch("/api/automation/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  businessName,
  contentType,
  targetAudience,
  tone,
  topic,
  instructions,
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Content automation failed.");
    }

    setResult(data.content || data.result || data.output || "");
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong while running the automation."
    );
  } finally {
    setLoading(false);
  }
};
const handleCopyContent = async () => {
  if (!result) return;

  try {
    await navigator.clipboard.writeText(result);
    alert("Content copied successfully.");
  } catch {
    alert("Unable to copy the generated content.");
  }
};
const handleDownloadContent = () => {
  if (!result) return;

  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "easy-platform-generated-content.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};
const handleRunEmailAutomation = async () => {
  setLoading(true);
  setError("");
  setResult("");

  try {
    const response = await fetch("/api/automation/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  businessName,
  targetAudience,
  tone,
  topic,
  instructions,
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
      throw new Error("Email automation failed.");
    }

    const data = await response.json();

    setResult(
      data.content ||
      data.output ||
      data.result ||
      "Email automation completed."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong while running Email Automation."
    );
  } finally {
    setLoading(false);
  }
};
const handleCopyEmail = async () => {
  if (!result) return;

  try {
    await navigator.clipboard.writeText(result);
    alert("Email copied successfully.");
  } catch {
    alert("Unable to copy the generated email.");
  }
};
const handleDownloadEmail = () => {
  if (!result) return;

  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "easy-platform-email.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};

const handleRunSocialAutomation = async () => {
  setLoading(true);
  setError("");
  setResult("");

  try {
    const response = await fetch("/api/automation/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  businessName,
  targetAudience,
  platform,
  postType,
  tone,
  topic,
  instructions,
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
      throw new Error("Social automation failed.");
    }

    const data = await response.json();

    setResult(
      data.content ||
        data.output ||
        data.result ||
        "Social post generated successfully."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong while running Social Automation."
    );
  } finally {
    setLoading(false);
  }
};
const handleCopySocialPost = async () => {
  if (!result) return;

  try {
    await navigator.clipboard.writeText(result);
    alert("Social post copied successfully.");
  } catch {
    alert("Unable to copy the social post.");
  }
};
const handleDownloadSocialPost = () => {
  if (!result) return;

  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "easy-platform-social-post.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};
const handleRunWorkflowAutomation = async () => {
  if (!automationGoal.trim()) {
    setWorkflowError("Please enter an automation goal.");
    return;
  }

  setWorkflowLoading(true);
  setWorkflowError("");
  setWorkflowResult("");

  try {
    const response = await fetch("/api/automation/workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  workflowName,
  automationGoal,
  trigger: workflowTrigger,
  workflowSteps,
  additionalInstructions: workflowInstructions,
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
      throw new Error("Workflow automation failed.");
    }

    const data = await response.json();

    setWorkflowResult(
      data.content ||
        data.output ||
        data.result ||
        "Workflow automation completed."
    );
  } catch (err) {
    setWorkflowError(
      err instanceof Error
        ? err.message
        : "Something went wrong while running Workflow Automation."
    );
  } finally {
    setWorkflowLoading(false);
  }
};
const handleCopyWorkflow = async () => {
  if (!workflowResult) return;

  try {
    await navigator.clipboard.writeText(workflowResult);
    alert("Workflow copied successfully.");
  } catch {
    alert("Unable to copy the generated workflow.");
  }
};
const handleDownloadWorkflow = () => {
  if (!workflowResult) return;

  const blob = new Blob([workflowResult], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "easy-platform-workflow.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};
const handleRunPipelineAutomation = async () => {
  setLoading(true);
  setError("");
  setResult("");

  try {
    const response = await fetch("/api/automation/pipeline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  businessName,
  pipelineGoal: topic,
  capabilities: instructions,
  instructions,
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
      throw new Error("AI pipeline generation failed.");
    }

    const data = await response.json();

    setResult(
      data.content ||
        data.output ||
        data.result ||
        "AI pipeline generated successfully."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Something went wrong while generating the AI Pipeline."
    );
  } finally {
    setLoading(false);
  }
};
const handleCopyPipeline = async () => {
  if (!result) return;

  try {
    await navigator.clipboard.writeText(result);
    alert("AI pipeline copied successfully.");
  } catch {
    alert("Unable to copy the generated AI pipeline.");
  }
};
const handleDownloadPipeline = () => {
  if (!result) return;

  const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "easy-platform-ai-pipeline.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};
  const automationTypes = [
    {
      id: "content" as AutomationType,
      icon: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6"/></svg>,
      title: "Content Creation",
      description:
        "Automatically generate blogs, ads, captions and marketing content.",
    },
    {
      id: "email" as AutomationType,
      icon: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>,
      title: "Email Automation",
      description:
        "Create and automate personalized email campaigns and follow-ups.",
    },
    {
      id: "social" as AutomationType,
      icon: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="m6.7 8 2.7 2M17.3 8l-2.7 2M6.7 16l2.7-2M17.3 16l-2.7-2"/></svg>,
      title: "Social Posting",
      description:
        "Generate and automate content across your social platforms.",
    },
    {
      id: "workflow" as AutomationType,
      icon: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M4 7h5l2 3h9M4 17h5l2-3h9"/><circle cx="4" cy="7" r="1.5"/><circle cx="4" cy="17" r="1.5"/><circle cx="20" cy="10" r="1.5"/><circle cx="20" cy="14" r="1.5"/></svg>,
      title: "Workflow Automation",
      description:
        "Connect business actions into intelligent automated workflows.",
    },
    {
      id: "pipeline" as AutomationType,
      icon: <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5v1a3 3 0 0 0 3 3h1M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5v1a3 3 0 0 1-3 3h-1M9 4v16M15 4v16M9 8h3M12 12h3M9 16h3"/></svg>,
      title: "AI Pipelines",
      description:
        "Run multiple AI capabilities together as one intelligent pipeline.",
    },
  ];

  const selectedAutomation = automationTypes.find(
    (item) => item.id === selectedType
  );

  return (
  <main className="flex min-h-screen bg-slate-950 text-white">
    <Sidebar />

    <section className="min-w-0 flex-1">
      <Navbar />

      <div className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-red-500/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-cyan-400/[0.025] blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <header className="relative mb-10 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-500/35 bg-red-500/10 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.16)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="m6.7 8 2.7 2M17.3 8l-2.7 2M6.7 16l2.7-2M17.3 16l-2.7-2"/></svg><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/></div>
              <div><div className="mb-1 flex flex-wrap items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]"/><span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Automation Intelligence</span><span className="rounded-full border border-red-500/20 bg-red-500/[0.05] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-red-300">System online / Automation core ready</span></div><h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Automation Command Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Design, coordinate and execute intelligent business automations from one operational layer.</p></div>
            </header>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {automationTypes.map((item) => {
                const active = selectedType === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedType(item.id)}
                    className={`group relative min-h-60 overflow-hidden rounded-[24px] border bg-[#FCFBF7] p-5 text-left shadow-[0_10px_30px_rgba(23,61,50,0.06)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]/30 ${
                      active
                        ? "border-[#A8B8A7] bg-[#F2F0E7] shadow-[0_14px_36px_rgba(23,61,50,0.11)]"
                        : "border-[#D8DCCF] hover:-translate-y-1 hover:border-[#A8B8A7] hover:shadow-[0_16px_38px_rgba(23,61,50,0.1)]"
                    }`}
                  >
                    <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[#B89A61]/70 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between"><div className={`flex h-12 w-12 items-center justify-center rounded-xl border bg-[#EEE9DC] text-[#173D32] transition-all ${active ? "border-[#A8B8A7] shadow-[0_8px_20px_rgba(23,61,50,0.1)]" : "border-[#D8DCCF] group-hover:border-[#A8B8A7]"}`}>{item.icon}</div><span className="font-mono text-[9px] tracking-[0.2em] text-[#7B847E]">AU-{String(automationTypes.indexOf(item) + 1).padStart(2, "0")}</span></div>

                    <h2 className="relative mt-5 text-base font-semibold text-[#173D32]">
                      {item.title}
                    </h2>

                    <p className="relative mt-2 text-sm leading-6 text-[#606A64]">
                      {item.description}
                    </p>
                    <div className="relative mt-5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6F786F]"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.45)]"/>{active ? "Module selected" : "System available"}</div>
                  </button>
                );
              })}
            </div>

            <div className="relative mt-8 overflow-hidden rounded-[28px] border border-red-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-red-950/15 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_0_35px_rgba(239,68,68,0.05)] sm:p-7">
              <div className="pointer-events-none absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-red-500/75 to-transparent"/>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-300">
                    Automation Configuration Matrix
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    {selectedAutomation?.title}
                  </h2>

                  <p className="mt-2 max-w-2xl text-slate-400">
                    {selectedAutomation?.description}
                  </p>
                </div>

                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Ready to configure
                </span>
              </div>

              <div className="relative mt-8 border-t border-red-500/10 pt-8">
  <h3 className="text-lg font-semibold text-white">
    Automation Configuration
  </h3>

  {selectedType === "content" && (
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Business / Brand Name</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Identity / 01</span></span><input type="text" placeholder="Business / Brand Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>

      <label className="group/format block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Content Type</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Format / 02</span></span><span className="relative block"><select value={contentType} onChange={(e) => setContentType(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Blog</option><option>Social Post</option><option>Ad Copy</option><option>Email Content</option><option>Product Description</option><option>Website Content</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/format:border-red-400/35 group-focus-within/format:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>

      <label className="block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Target Audience</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Audience / 03</span></span><input type="text" placeholder="Target Audience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="h-13 w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>

      <label className="group/voice block"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Tone</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Voice / 04</span></span><span className="relative block"><select value={tone} onChange={(e) => setTone(e.target.value)} className="h-13 w-full appearance-none rounded-xl border border-white/[0.08] bg-slate-950/80 px-4 pr-12 text-sm text-white outline-none transition-all hover:border-red-500/25 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"><option>Professional</option><option>Friendly</option><option>Luxury</option><option>Persuasive</option><option>Educational</option><option>Bold</option></select><span className="pointer-events-none absolute right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300 group-focus-within/voice:border-red-400/35 group-focus-within/voice:text-red-300"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.5"><path d="m4 6 4 4 4-4"/></svg></span></span></label>

      <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Topic / Content Brief</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Prompt / 05</span></span><textarea placeholder="Topic / Content Brief" value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-36 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>

      <label className="block md:col-span-2"><span className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Additional Instructions</span><span className="text-[8px] uppercase tracking-[0.16em] text-cyan-400/70">Directive / 06</span></span><textarea placeholder="Additional Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-28 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"/></label>

      <button
        type="button"
        onClick={handleRunContentAutomation}
        disabled={loading}
        className="group/button flex min-h-12 items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
      >
        {loading ? "Executing Automation Intelligence..." : "Run Content Automation"}
      </button>

    {error && (
  <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
    {error}
  </div>
)}

{result && (
  <div className="relative mt-6 w-full overflow-hidden rounded-2xl border border-red-500/25 bg-slate-950/75 p-5 shadow-[0_0_24px_rgba(239,68,68,0.07)] before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent sm:p-7 md:col-span-2">
    <div className="relative mb-6 flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Automation Output / Ready
        </p>
        <h3 className="mt-1 text-xl font-bold text-white">
          Generated Content
        </h3>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
        <button type="button" onClick={handleCopyContent} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Content</button>
        <button type="button" onClick={handleDownloadContent} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Content</button>
      </div>
    </div>

    <article className="relative max-w-none break-words text-[15px] leading-[1.8] tracking-[0.005em] text-slate-300 sm:text-base">
      {result.split("\n").map((line, index) => {
        const sectionHeading = line.match(/^#{1,3}\s+(.+)$/);

        if (sectionHeading) {
          return (
            <h4 key={index} className="mb-2 mt-7 text-lg font-semibold leading-snug tracking-tight text-slate-100 first:mt-0 sm:text-xl">
              {sectionHeading[1]}
            </h4>
          );
        }

        return (
          <span key={index} className="block min-h-[1.8em] whitespace-pre-wrap">
            {line}
          </span>
        );
      })}
    </article>
  </div>
)}
  
</div>
)}
{selectedType === "email" && (
  <div className="mt-6 grid gap-5">
    <div className="grid gap-5 md:grid-cols-2">
      <input
        type="text"
        placeholder="Business / Brand Name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      />

      <input
        type="text"
        placeholder="Target Audience"
        value={targetAudience}
        onChange={(e) => setTargetAudience(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      />

      <select
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      >
        <option>Professional</option>
        <option>Friendly</option>
        <option>Luxury</option>
        <option>Persuasive</option>
        <option>Educational</option>
        <option>Bold</option>
      </select>

      <select
        value={contentType}
        onChange={(e) => setContentType(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      >
        <option>Campaign Email</option>
        <option>Promotional Email</option>
        <option>Welcome Email</option>
        <option>Follow-up Email</option>
        <option>Newsletter</option>
        <option>Sales Email</option>
      </select>
    </div>

    <textarea
      placeholder="Email Subject / Goal"
      value={topic}
      onChange={(e) => setTopic(e.target.value)}
      className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <textarea
      placeholder="Main Message / Offer / Call To Action"
      value={instructions}
      onChange={(e) => setInstructions(e.target.value)}
      className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <button
      type="button"
      onClick={handleRunEmailAutomation}
      disabled={loading}
      className="group/button flex min-h-12 items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Executing Automation Intelligence..." : "Generate Email Automation"}
    </button>
    {result && (
  <div className="relative mt-6 overflow-hidden rounded-2xl border border-red-500/25 bg-slate-950/75 p-6 shadow-[0_0_24px_rgba(239,68,68,0.07)] before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent">
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Automation Output / Ready
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Generated Email
        </h3>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
        <button type="button" onClick={handleCopyEmail} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Email</button>
        <button type="button" onClick={handleDownloadEmail} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Email</button>
      </div>
    </div>

    <div className="relative mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">
      {result}
    </div>
  </div>
)}
  </div>
)}
{selectedType === "social" && (
  <div className="mt-6 grid gap-5">
    <div className="grid gap-5 md:grid-cols-2">
      <input
        type="text"
        placeholder="Business / Brand Name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      />

      <input
        type="text"
        placeholder="Target Audience"
        value={targetAudience}
        onChange={(e) => setTargetAudience(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      />

      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      >
        <option>Instagram</option>
        <option>Facebook</option>
        <option>LinkedIn</option>
        <option>X / Twitter</option>
        <option>TikTok</option>
      </select>

      <select
        value={postType}
        onChange={(e) => setPostType(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      >
        <option>Promotional Post</option>
        <option>Educational Post</option>
        <option>Product Post</option>
        <option>Brand Awareness</option>
        <option>Engagement Post</option>
      </select>

      <select
        value={tone}
        onChange={(e) => setTone(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      >
        <option>Professional</option>
        <option>Friendly</option>
        <option>Luxury</option>
        <option>Persuasive</option>
        <option>Bold</option>
      </select>
    </div>

    <textarea
      placeholder="Topic / Goal"
      value={topic}
      onChange={(e) => setTopic(e.target.value)}
      className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <textarea
      placeholder="Additional Instructions"
      value={instructions}
      onChange={(e) => setInstructions(e.target.value)}
      className="min-h-28 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <button
      type="button"
      onClick={handleRunSocialAutomation}
      disabled={loading}
      className="group/button flex min-h-12 items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Executing Automation Intelligence..." : "Generate Social Post"}
    </button>

    {result && (
      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-slate-950/75 p-6 shadow-[0_0_24px_rgba(239,68,68,0.07)] before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Automation Output / Ready
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Generated Social Post
            </h3>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={handleCopySocialPost} className="flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Post</button>
            <button type="button" onClick={handleDownloadSocialPost} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Post</button>
          </div>
        </div>

        <div className="relative mt-4 whitespace-pre-wrap leading-7 text-slate-300">
          {result}
        </div>
      </div>
    )}
  </div>
)}
{selectedType === "workflow" && (
  <div className="mt-6 grid gap-5">
    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Business / Workflow Name</span><input type="text" placeholder="Lead Management Workflow" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" /></label>

    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Automation Goal</span><textarea placeholder="Describe the business outcome this workflow should achieve" value={automationGoal} onChange={(e) => setAutomationGoal(e.target.value)} className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" /></label>

    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Trigger</span><textarea placeholder="What event starts this workflow?" value={workflowTrigger} onChange={(e) => setWorkflowTrigger(e.target.value)} className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" /></label>

    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Workflow Steps / Required Actions</span><textarea placeholder="List the actions, decisions, notifications, or handoffs the workflow should include" value={workflowSteps} onChange={(e) => setWorkflowSteps(e.target.value)} className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" /></label>

    <label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Additional Instructions</span><textarea placeholder="Add constraints, tools, integrations, conditions, or special requirements" value={workflowInstructions} onChange={(e) => setWorkflowInstructions(e.target.value)} className="min-h-28 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]" /></label>

    <button
      type="button"
      onClick={handleRunWorkflowAutomation}
      disabled={workflowLoading}
      className="group/button flex min-h-12 items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {workflowLoading ? "Executing Automation Intelligence..." : "Generate Workflow Automation"}
    </button>

    {workflowError && (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
        {workflowError}
      </div>
    )}

    {workflowResult && (
      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-slate-950/75 p-6 shadow-[0_0_24px_rgba(239,68,68,0.07)] before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Automation Output / Ready</p>
            <h3 className="mt-2 text-xl font-bold text-white">Generated Workflow</h3>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
            <button type="button" onClick={handleCopyWorkflow} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Workflow</button>
            <button type="button" onClick={handleDownloadWorkflow} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Workflow</button>
          </div>
        </div>

        <div className="relative mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">
          {workflowResult}
        </div>
      </div>
    )}
  </div>
)}

{selectedType === "pipeline" && (
  <div className="mt-6 grid gap-5">
    <input
      type="text"
      placeholder="Business / Pipeline Name"
      value={businessName}
      onChange={(e) => setBusinessName(e.target.value)}
        className="rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <textarea
      placeholder="Pipeline Goal"
      value={topic}
      onChange={(e) => setTopic(e.target.value)}
      className="min-h-24 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <textarea
      placeholder="AI Capabilities / Modules To Combine"
      value={instructions}
      onChange={(e) => setInstructions(e.target.value)}
      className="min-h-32 w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/80 p-4 text-sm leading-6 text-white outline-none transition-all placeholder:text-slate-600 hover:border-red-500/20 focus:border-red-400/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
    />

    <button
      type="button"
      onClick={handleRunPipelineAutomation}
      disabled={loading}
      className="group/button flex min-h-12 items-center justify-center gap-3 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/25 via-red-500/15 to-cyan-400/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_28px_rgba(239,68,68,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Executing Automation Intelligence..." : "Generate AI Pipeline"}
    </button>

    {error && (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
        {error}
      </div>
    )}

    {result && (
      <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-slate-950/75 p-6 shadow-[0_0_24px_rgba(239,68,68,0.07)] before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-gradient-to-r before:from-transparent before:via-red-500/60 before:to-transparent">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Automation Output / Ready
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Generated AI Pipeline
            </h3>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
            <button type="button" onClick={handleCopyPipeline} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition-all hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-cyan-300" strokeWidth="1.5"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M13.5 6.5V5A1.5 1.5 0 0 0 12 3.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/></svg>Copy Pipeline</button>
            <button type="button" onClick={handleDownloadPipeline} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-r from-red-500/20 to-cyan-400/[0.08] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-red-300/60 hover:shadow-[0_0_22px_rgba(239,68,68,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-red-300" strokeWidth="1.5"><path d="M10 3.5v9m-3-3 3 3 3-3M4 15.5h12"/></svg>Download Pipeline</button>
          </div>
        </div>

        <div className="relative mt-5 whitespace-pre-wrap break-words text-base leading-[1.8] text-slate-300">
          {result}
        </div>
      </div>
    )}
  </div>
)}
</div>
</div>
</div>
</div>
</section>
</main>
);
}

export default function AutomationPage() {
  return (
    <Suspense fallback={null}>
      <AutomationPageContent />
    </Suspense>
  );
}
