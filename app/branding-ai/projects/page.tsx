"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../../lib/auth";
import type { BrandingAiOutput } from "../../lib/ai";

type BrandingProject = {
  id: string;
  name: string;
  companyName: string;
  industry: string;
  targetAudience: string;
  brandStyle: string;
  brandDescription: string;
  result: BrandingAiOutput | null;
  createdAt?: string;
};

type BrandingProjectRecord = Partial<Omit<BrandingProject, "result">> & {
  result?: unknown;
};

export default function BrandingProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<BrandingProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/projects?userId=${encodeURIComponent(user.uid)}`
        );

        if (!response.ok) {
          throw new Error("Failed to load projects");
        }

        const data = await response.json() as { projects?: BrandingProjectRecord[] };

        const brandingProjects = (data.projects || []).filter(
          (project) =>
            project.name?.toLowerCase().includes("branding")
        );

        const formattedProjects: BrandingProject[] = brandingProjects.map((project) => ({
          id: project.id || "",
          name: project.name || "",
          companyName: project.companyName || "",
          industry: project.industry || "",
          targetAudience: project.targetAudience || "",
          brandStyle: project.brandStyle || "",
          brandDescription: project.brandDescription || "",
          result:
            typeof project.result === "string"
              ? JSON.parse(project.result) as BrandingAiOutput
              : project.result as BrandingAiOutput | null,
          createdAt: project.createdAt,
        }));

        setProjects(formattedProjects);
      } catch (error) {
        console.error("Branding project loading error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const openProject = (project: BrandingProject) => {
    router.push(`/branding-ai?projectId=${encodeURIComponent(project.id)}`);
  };

  const deleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      setProjects((current) =>
        current.filter((project) => project.id !== id)
      );
    } catch (error) {
      console.error("Delete project error:", error);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020817] p-10 text-white">
        Loading projects...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020817] px-8 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.3em] text-cyan-400">
          PROJECT LIBRARY
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Branding Project History
        </h1>

        <p className="mt-3 text-slate-400">
          Open, continue, or remove your saved branding projects.
        </p>

        {projects.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
            <p className="text-slate-400">
              No branding projects saved yet.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-3xl border border-cyan-500/20 bg-slate-900/70 p-6"
              >
                <p className="text-sm font-medium text-cyan-400">
                  {project.industry || "Branding"}
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  {project.name}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {project.companyName}
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
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
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
