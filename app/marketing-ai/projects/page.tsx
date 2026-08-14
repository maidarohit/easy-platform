"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../../lib/auth";

type MarketingProject = {
  id: string;
  projectName: string;
  companyName: string;
  industry: string;
  targetAudience: string;
  brandStyle: string;
  brandDescription: string;
  result: Record<string, unknown> | null;
  createdAt: string;
};

type MarketingProjectRecord = Partial<Omit<MarketingProject, "projectName" | "result">> & {
  name?: string;
  result?: string | Record<string, unknown> | null;
};

export default function MarketingProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<MarketingProject[]>([]);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setProjects([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/projects?userId=${encodeURIComponent(user.uid)}`
      );

      const data = await response.json() as { projects?: MarketingProjectRecord[] };

      if (!response.ok) {
        console.error("Failed to load projects:", data);
        return;
      }

      const formattedProjects: MarketingProject[] = (data.projects || []).map((project) => ({
        id: project.id || "",
        projectName: project.name || "",
        companyName: project.companyName || "",
        industry: project.industry || "",
        targetAudience: project.targetAudience || "",
        brandStyle: project.brandStyle || "",
        brandDescription: project.brandDescription || "",
        result: typeof project.result === "string" ? JSON.parse(project.result) as Record<string, unknown> : project.result || null,
        createdAt: project.createdAt || "",
      }));

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Project loading error:", error);
    }
  });

  return () => unsubscribe();
}, []);
  const openProject = (project: MarketingProject) => {
    router.push(`/marketing-ai?projectId=${encodeURIComponent(project.id)}`);
  };

  const deleteProject = (id: string) => {
    const updatedProjects = projects.filter(
      (project) => project.id !== id
    );

    setProjects(updatedProjects);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/70">
            Project Library
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            Marketing Project History
          </h1>

          <p className="mt-3 text-slate-400">
            Open, continue, or remove your saved marketing projects.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-cyan-500/15 bg-slate-900/60 p-10 text-center">
            <p className="text-xl font-semibold">
              No saved marketing projects yet
            </p>

            <p className="mt-3 text-slate-400">
              Generate and save a marketing strategy first.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-3xl border border-cyan-500/15 bg-slate-900/60 p-6"
              >
                <p className="text-sm text-cyan-300">
                  {project.industry}
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  {project.projectName}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {new Date(project.createdAt).toLocaleString()}
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => openProject(project)}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Open Project
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
