"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../dashboard/components/Sidebar";
import { useProjectMemory } from "../hooks/useProjectMemory";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type WorkspaceData = {
  project: { id: string; name: string; companyName?: string | null; industry?: string | null; goal?: string | null; businessDescription?: string | null };
  sections: Array<{
    module: string;
    state: "Ready" | "Not generated" | "In progress";
    outputId: string | null;
    output: Record<string, unknown> | null;
    approvedAt: string | null;
    reviewState: "Approved" | "Needs review" | null;
  }>;
};

const MODULE_DETAILS: Readonly<Record<string, { number: string; title: string; description: string; href: string }>> = {
  "ai-manager": { number: "01", title: "AI Manager", description: "Unified business intelligence and master strategy.", href: "/ai-manager" },
  branding: { number: "02", title: "Branding", description: "Brand positioning, identity, voice and visual direction.", href: "/branding-ai" },
  logo: { number: "03", title: "Logo", description: "Logo concept, symbolism, colors and typography.", href: "/dashboard/logo-ai" },
  content: { number: "04", title: "Content", description: "Customer-ready business and marketing content.", href: "/dashboard/content-ai" },
  website: { number: "05", title: "Website", description: "Website strategy, structure and business experience.", href: "/dashboard/website-ai" },
  marketing: { number: "06", title: "Marketing", description: "Campaigns, channels, content and growth strategy.", href: "/marketing-ai" },
  seo: { number: "07", title: "SEO", description: "Search strategy, keywords and organic growth.", href: "/seo-ai" },
  uiux: { number: "08", title: "UI/UX", description: "Customer journeys, interface and experience strategy.", href: "/uiux-ai" },
  sales: { number: "09", title: "Sales", description: "Lead conversion, sales process and revenue strategy.", href: "/sales-ai" },
  analytics: { number: "10", title: "Analytics", description: "Performance intelligence, KPIs and recommendations.", href: "/analytics-ai" },
};

const fieldLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

function MasterWorkspaceContent() {
  const {
    project,
    projectId,
    loading,
    error,
    connected,
  } = useProjectMemory();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(Boolean(projectId));
  const [workspaceError, setWorkspaceError] = useState("");
  const [approvingOutputId, setApprovingOutputId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void authenticatedFetch(`/api/master-workspace?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this workspace.");
        if (active) setWorkspace(data as WorkspaceData);
      })
      .catch((loadError) => { if (active) setWorkspaceError(loadError instanceof Error ? loadError.message : "Unable to load this workspace."); })
      .finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  const approveOutput = async (outputId: string) => {
    if (!projectId || approvingOutputId) return;
    setApprovingOutputId(outputId);
    setWorkspaceError("");
    try {
      const response = await authenticatedFetch("/api/master-workspace/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, outputId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to approve this output.");
      setWorkspace((current) => current ? {
        ...current,
        sections: current.sections.map((section) => section.outputId === outputId ? {
          ...section,
          approvedAt: data.approvedAt as string,
          reviewState: "Approved",
        } : section),
      } : current);
    } catch (approvalError) {
      setWorkspaceError(approvalError instanceof Error ? approvalError.message : "Unable to approve this output.");
    } finally {
      setApprovingOutputId(null);
    }
  };

  const projectLink = (path: string) =>
    projectId
      ? `${path}?projectId=${encodeURIComponent(projectId)}`
      : path;

  const modules = workspace?.sections.map((section) => ({ ...MODULE_DETAILS[section.module], ...section }))
    .filter((module) => Boolean(module.number)) ?? [];
  const displayedProject = workspace?.project ?? project;

  if (loading || workspaceLoading) {
    return (
      <div className="flex min-h-screen bg-[#f7f3e9]">
        <Sidebar />

        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#0d493b] border-t-transparent" />
            <p className="mt-4 text-sm tracking-[0.2em] text-[#66756f]">
              LOADING PROJECT INTELLIGENCE
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f7f3e9] text-[#103c32]">
      <Sidebar />

      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10 xl:px-14">
        <div className="mx-auto max-w-[1500px]">

          {/* HEADER */}
          <section className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#9edfe9] bg-white/70 px-4 py-2 text-[10px] font-semibold tracking-[0.25em] text-[#13cdea]">
                MASTER INTELLIGENCE WORKSPACE
              </span>

              <span
                className={`rounded-full border px-4 py-2 text-[10px] font-semibold tracking-[0.2em] ${
                  connected
                    ? "border-[#9edfe9] bg-[#ecfbfb] text-[#10bfd8]"
                    : "border-[#e0d7c7] bg-white text-[#9a8768]"
                }`}
              >
                {connected ? "● PROJECT MEMORY CONNECTED" : "PROJECT MEMORY OFFLINE"}
              </span>
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#103c32] md:text-6xl">
              Master Workspace
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-[#66756f]">
              One central operating workspace for strategy, brand, website,
              marketing, sales, analytics and creative intelligence.
            </p>
          </section>

          {(error || workspaceError) && (
            <div className="mb-6 rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {error || workspaceError}
            </div>
          )}

          {/* PROJECT COMMAND CARD */}
          <section className="relative mb-8 overflow-hidden rounded-[30px] border border-[#ded9cc] bg-white/75 p-6 shadow-[0_20px_60px_rgba(55,75,66,0.07)] md:p-8">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ff6e7f] via-[#ffb7af] to-[#30d9ec]" />

            <div className="flex flex-col justify-between gap-8 xl:flex-row">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#f5c7c4] bg-[#fff1ee] text-xl">
                    ✦
                  </div>

                  <div>
                    <p className="text-[10px] font-bold tracking-[0.27em] text-[#c59a5d]">
                      ACTIVE BUSINESS PROJECT
                    </p>

                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                      {displayedProject?.name ||
                        displayedProject?.companyName ||
                        "No project selected"}
                    </h2>
                  </div>
                </div>

                <p className="max-w-3xl leading-7 text-[#66756f]">
                  {displayedProject?.businessDescription ||
                    "Open a saved project from the Dashboard to connect its business memory to this workspace."}
                </p>
              </div>

              <div className="grid min-w-[300px] grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#e5e0d5] bg-[#faf8f1] p-4">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-[#9b8b72]">
                    INDUSTRY
                  </p>
                  <p className="mt-2 font-semibold">
                    {displayedProject?.industry || "Not provided"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e5e0d5] bg-[#faf8f1] p-4">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-[#9b8b72]">
                    BUSINESS GOAL
                  </p>
                  <p className="mt-2 font-semibold">
                    {displayedProject?.goal || "Not provided"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e5e0d5] bg-[#faf8f1] p-4">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-[#9b8b72]">
                    PROJECT MEMORY
                  </p>
                  <p className="mt-2 font-semibold text-[#13bfd6]">
                    {connected ? "Connected" : "Not connected"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e5e0d5] bg-[#faf8f1] p-4">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-[#9b8b72]">
                    AI STRATEGY
                  </p>
                  <p className="mt-2 font-semibold">
                    {workspace?.sections.some((section) => section.module === "ai-manager" && section.state === "Ready") ? "Saved" : "Not generated"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* MODULE MATRIX */}
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-[#13c8df]">
                  BUSINESS INTELLIGENCE MATRIX
                </p>

                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
                  Core Workspace
                </h2>
              </div>

              <div className="hidden text-right md:block">
                <p className="text-xs tracking-[0.18em] text-[#8e968f]">
                  10 CONNECTED SYSTEMS
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => (
                <article
                  key={module.title}
                  className="relative overflow-hidden rounded-[26px] border border-[#dedbd2] bg-white/80 p-5"
                >
                  <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[60px] bg-[#fff0ed] opacity-70 transition group-hover:bg-[#e9fbfc]" />

                  <div className="relative">
                    <div className="mb-8 flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#353342] text-xs font-bold tracking-[0.15em] text-white">
                        {module.number}
                      </div>

                      <span className="rounded-full border border-[#cde9e8] bg-[#f4ffff] px-3 py-1 text-[9px] font-bold tracking-[0.18em] text-[#12bfd6]">
                        {module.state}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold tracking-[-0.025em]">
                      {module.title}
                    </h3>

                    <p className="mt-3 min-h-[60px] text-sm leading-6 text-[#737d78]">
                      {module.description}
                    </p>

                    {module.state === "Ready" && (
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#ece7de] bg-[#faf8f1] px-3 py-2">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                          module.reviewState === "Approved" ? "text-[#3b9584]" : "text-[#b07d31]"
                        }`}>
                          {module.reviewState}
                        </span>
                        {module.reviewState === "Needs review" && module.outputId && (
                          <button
                            type="button"
                            disabled={Boolean(approvingOutputId)}
                            onClick={() => void approveOutput(module.outputId as string)}
                            className="rounded-full bg-[#103c32] px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-white transition hover:bg-[#185a4b] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {approvingOutputId === module.outputId ? "APPROVING..." : "APPROVE"}
                          </button>
                        )}
                      </div>
                    )}

                    {module.output && (
                      <details className="mt-4 rounded-2xl border border-[#ece7de] bg-[#faf8f1] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#103c32]">View latest output</summary>
                        <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                          {Object.entries(module.output).map(([field, value]) => (
                            <div key={field}>
                              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#9b8b72]">{fieldLabel(field)}</p>
                              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#66756f]">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-[#ece7de] pt-4">
                      <Link href={projectLink(module.href)} className="text-[10px] font-semibold tracking-[0.18em] text-[#0ec7df]">
                        OPEN ADVANCED TOOL
                      </Link>

                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#9edfe9] text-[#0ec7df] transition group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* CREATIVE + AUTOMATION */}
          <section className="mt-8 grid gap-5 xl:grid-cols-2">
            <Link
              href={projectLink("/dashboard/creative-ai")}
              className="rounded-[28px] border border-[#f0cfca] bg-gradient-to-br from-white to-[#fff2ef] p-7 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-[10px] font-bold tracking-[0.25em] text-[#e28a7b]">
                CREATIVE PRODUCTION
              </p>

              <h3 className="mt-3 text-2xl font-semibold">
                Creative AI Suite
              </h3>

              <p className="mt-3 leading-7 text-[#6f7874]">
                Logo concepts, image, content, presentation and video generation
                connected to this business project.
              </p>

              <div className="mt-6 text-sm font-semibold text-[#d66f62]">
                Open Creative Suite →
              </div>
            </Link>

            <Link
              href={projectLink("/dashboard/automation")}
              className="rounded-[28px] border border-[#cfe4df] bg-gradient-to-br from-white to-[#effaf6] p-7 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-[10px] font-bold tracking-[0.25em] text-[#4fa997]">
                BUSINESS OPERATIONS
              </p>

              <h3 className="mt-3 text-2xl font-semibold">
                Automation Center
              </h3>

              <p className="mt-3 leading-7 text-[#6f7874]">
                Connect workflows, approvals, content planning and operational
                automations to the same project.
              </p>

              <div className="mt-6 text-sm font-semibold text-[#3b9584]">
                Open Automation →
              </div>
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function MasterWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f3e9] text-[#103c32]">
          Loading Master Workspace...
        </div>
      }
    >
      <MasterWorkspaceContent />
    </Suspense>
  );
}
