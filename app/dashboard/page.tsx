"use client";

import { Suspense, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import StatsCards from "./components/StatsCards";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { useRouter } from "next/navigation";
import { customerProjectAction } from "@/app/lib/customer-navigation";

type Project = {
  id: string;
  userId: string;
  name: string;
  companyName?: string;
  industry?: string;
  targetAudience?: string;
  goal?: string;
  brandStyle?: string;
  brandDescription?: string;
  result?: string;
  location?: string;
  businessStage?: string;
  originalBrief?: string;
};

type DashboardSummary = {
  aiRequests: number;
  availableAiTools: number;
  activeAiJobs: number;
};

function DashboardPageContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState("");
  const [dashboardSummary, setDashboardSummary] = useState<
    DashboardSummary | null | undefined
  >(undefined);
  const [summaryError, setSummaryError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectActions, setProjectActions] = useState<Record<string, { label: string; href: string }>>({});
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoadingProjects(true);
        setError("");

        if (!user) {
          setProjects([]);
          setCustomerName("");
          router.replace("/login");
          return;
        }

        if (!user.emailVerified) {
          setProjects([]);
          router.replace("/verify-email");
          return;
        }

        setCustomerName(user.displayName?.trim().slice(0, 100) || "");

        const response = await authenticatedFetch(
          `/api/projects?userId=${encodeURIComponent(user.uid)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load projects");
        }

        setProjects(data.projects || []);
      } catch (err) {
        console.error("Load projects error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load projects"
        );
      } finally {
        setLoadingProjects(false);
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSummaryError("");

      if (!user) {
        setDashboardSummary(undefined);
        return;
      }

      if (!user.emailVerified) {
        setDashboardSummary(undefined);
        return;
      }

      try {
        const response = await authenticatedFetch("/api/dashboard/summary");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load dashboard summary");
        }

        setDashboardSummary(data as DashboardSummary);
      } catch (err) {
        console.error("Load dashboard summary error:", err);
        setDashboardSummary(null);
        setSummaryError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard summary"
        );
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (projects.length === 0) return;
    let active = true;
    void Promise.all(projects.map(async (project) => {
      const fallback = customerProjectAction(project);
      if (fallback.label === "Tell us about your business") return [project.id, fallback] as const;
      try {
        const [previewResponse, publicationResponse] = await Promise.all([
          authenticatedFetch(`/api/business-preview?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" }),
          authenticatedFetch(`/api/business-publications?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" }),
        ]);
        const publicationData = await publicationResponse.json();
        if (publicationResponse.ok && publicationData.publication?.status === "active" && publicationData.publication.publicUrl) {
          return [project.id, { label: "View Live Business", href: publicationData.publication.publicUrl as string }] as const;
        }
        if (!previewResponse.ok) return [project.id, fallback] as const;
        const previewData = await previewResponse.json();
        const outputIds = Array.isArray(previewData.preview?.approval?.outputIds) ? previewData.preview.approval.outputIds : [];
        if (outputIds.length === 0) return [project.id, { label: "Build My Business", href: `/onboarding?projectId=${encodeURIComponent(project.id)}` }] as const;
        return [project.id, {
          label: previewData.preview?.approval?.approved ? "Publish My Business" : "Review My Business",
          href: `/business-preview?projectId=${encodeURIComponent(project.id)}`,
        }] as const;
      } catch { return [project.id, fallback] as const; }
    })).then((entries) => { if (active) setProjectActions(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [projects]);

  const openAdvancedTools = (project: Project) => {
    router.push(`/master-workspace?projectId=${encodeURIComponent(project.id)}#advanced-tools`);
  };
  const continueBusiness = (project: Project) => router.push((projectActions[project.id] ?? customerProjectAction(project)).href);
  const filteredProjects = projects.filter((project) => {
  const query = searchQuery.toLowerCase();

  return (
    project.name?.toLowerCase().includes(query) ||
    project.companyName?.toLowerCase().includes(query) ||
    project.industry?.toLowerCase().includes(query)
  );
});

  return (
    <main className="flex min-h-screen bg-slate-950">
      <Sidebar />

      <section className="flex-1">
        <Navbar
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
/>

        <div className="px-5 py-8 sm:px-8 lg:p-10">
  <div className="mb-10 flex items-center gap-4">
    <div
      className="
        flex h-14 w-14 items-center justify-center
        rounded-2xl
        border border-red-500/30
        bg-red-500/10
        text-2xl
        shadow-[0_0_30px_rgba(239,68,68,0.18)]
      "
    >
      ◈
    </div>

    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]" />

        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">
          Your business
        </span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight text-white">
        {customerName ? `Welcome, ${customerName}` : "Welcome"}{" "}
        <span aria-hidden="true">👋</span>
      </h1>

      <p className="mt-2 text-sm text-slate-400">
        Continue building, reviewing and publishing your business.
      </p>
    </div>
  </div>

          <section className="mb-10 rounded-[24px] border border-emerald-400/30 bg-gradient-to-br from-emerald-950/80 to-slate-900 p-6 shadow-[0_18px_50px_rgba(16,185,129,0.12)] sm:p-8" aria-labelledby="start-new-business-heading">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Start something new</p>
            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 id="start-new-business-heading" className="text-2xl font-semibold text-white sm:text-3xl">Create a fresh business</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">Tell us what you do or what you want to build. You don&apos;t need a business plan.</p>
              </div>
              <button type="button" onClick={() => { sessionStorage.removeItem("easy-selected-business-idea"); router.push("/onboarding"); }} className="inline-flex min-h-14 w-full shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-6 text-base font-bold text-slate-950 shadow-[0_12px_30px_rgba(52,211,153,0.22)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 lg:w-auto">
                + Start a New Business
              </button>
            </div>
          </section>

          <StatsCards
            projectCount={projects.length}
            aiRequests={
              dashboardSummary === null ? null : dashboardSummary?.aiRequests
            }
            availableAiTools={
              dashboardSummary === null
                ? null
                : dashboardSummary?.availableAiTools
            }
            activeAiJobs={
              dashboardSummary === null ? null : dashboardSummary?.activeAiJobs
            }
          />

          {summaryError && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {summaryError}
            </p>
          )}

          <div id="saved-projects" className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Your Businesses
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Continue an existing business below. Advanced Tools remain available when you need them.
                </p>
              </div>

              <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
                {projects.length} saved
              </div>
            </div>

            {loadingProjects && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
                Loading projects...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-300">
                {error}
              </div>
            )}

            {!loadingProjects && !error && filteredProjects.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
                No saved projects found.
              </div>
            )}

            {!loadingProjects && !error && filteredProjects.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProjects.map((project) => (
                  <div
  key={project.id}
  className="
    group relative overflow-hidden rounded-[24px]
    border border-red-500/15
    bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20
    p-6
    transition-all duration-300
    hover:-translate-y-1
    hover:border-red-500/40
    hover:shadow-[0_0_35px_rgba(239,68,68,0.14)]
  "
>
  {/* TOP NEON LINE */}
  <div
    className="
      absolute left-0 top-0 h-[2px] w-full
      bg-gradient-to-r
      from-transparent via-red-500/70 to-transparent
      opacity-40
      transition-opacity duration-300
      group-hover:opacity-100
    "
  />

  {/* BACKGROUND GLOW */}
  <div
    className="
      pointer-events-none absolute -right-20 -top-20
      h-44 w-44 rounded-full
      bg-red-500/10 blur-3xl
      transition-all duration-500
      group-hover:bg-red-500/20
    "
  />

  <div
    className="
      pointer-events-none absolute -bottom-20 -left-20
      h-40 w-40 rounded-full
      bg-cyan-400/5 blur-3xl
    "
  />

  {/* PROJECT HEADER */}
  <div className="relative mb-6 flex items-start justify-between gap-4">
    <div className="flex items-start gap-4">
      <div
        className="
          flex h-11 w-11 shrink-0 items-center justify-center
          rounded-xl
          border border-red-500/20
          bg-red-500/10
          text-red-300
          shadow-[0_0_20px_rgba(239,68,68,0.10)]
          transition-all duration-300
          group-hover:border-red-500/40
          group-hover:shadow-[0_0_25px_rgba(239,68,68,0.18)]
        "
      >
        ◈
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="
              h-1.5 w-1.5 rounded-full
              bg-cyan-400
              shadow-[0_0_8px_rgba(34,211,238,0.8)]
            "
          />

          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400">
            My Business
          </p>
        </div>

        <h3 className="text-xl font-semibold tracking-tight text-white">
          {project.name}
        </h3>
      </div>
    </div>

    <div
      className="
        rounded-full
        border border-red-500/20
        bg-red-500/5
        px-3 py-1
        text-[9px] font-semibold uppercase
        tracking-[0.18em] text-red-300
      "
    >
      Saved
    </div>
  </div>

  {/* PROJECT INFORMATION */}
  <div className="relative grid gap-3">
    <div
      className="
        flex items-center justify-between gap-4
        rounded-xl border border-slate-800/80
        bg-slate-950/40 px-4 py-3
      "
    >
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
        Company
      </span>

      <span className="text-right text-sm font-medium text-slate-200">
        {project.companyName || "Not provided"}
      </span>
    </div>

    <div
      className="
        flex items-center justify-between gap-4
        rounded-xl border border-slate-800/80
        bg-slate-950/40 px-4 py-3
      "
    >
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
        Industry
      </span>

      <span className="text-right text-sm font-medium text-slate-200">
        {project.industry || "Not provided"}
      </span>
    </div>

    <div
      className="
        flex items-center justify-between gap-4
        rounded-xl border border-slate-800/80
        bg-slate-950/40 px-4 py-3
      "
    >
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
        Goal
      </span>

      <span className="text-right text-sm font-medium text-slate-200">
        {project.goal || "Not provided"}
      </span>
    </div>
  </div>

  {/* PROJECT ACTIONS */}
  <button
    onClick={() => continueBusiness(project)}
    className="relative mt-6 flex w-full items-center justify-between overflow-hidden rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3.5 font-semibold text-white transition-all duration-300 hover:border-cyan-300/60 hover:bg-cyan-400/15"
  >
    <span>Continue Business</span>
    <span aria-hidden="true">→</span>
  </button>
  <button
    onClick={() => openAdvancedTools(project)}
    className="
      relative mt-3 flex w-full items-center justify-between
      overflow-hidden rounded-xl
      border border-red-500/30
      bg-gradient-to-r from-red-500/15 via-red-500/10 to-cyan-400/10
      px-5 py-3.5
      font-semibold text-white
      transition-all duration-300
      hover:border-red-400/60
      hover:bg-red-500/20
      hover:shadow-[0_0_28px_rgba(239,68,68,0.18)]
    "
  >
    <span className="flex items-center gap-3">
      <span className="text-red-300">◉</span>
      Open Advanced Tools
    </span>

    <span
      className="
        flex h-7 w-7 items-center justify-center
        rounded-full
        border border-cyan-400/20
        bg-cyan-400/5
        text-cyan-300
      "
    >
      →
    </span>
  </button>
</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={null}><DashboardPageContent /></Suspense>;
}
