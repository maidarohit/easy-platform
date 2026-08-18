"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import auth from "../../../lib/auth";
import { authenticatedFetch } from "../../../lib/authenticated-fetch";
import type { WebsiteAiOutput } from "../../../lib/ai";

type WebsiteProject = {
  id: string;
  userId: string;
  name: string;
  companyName: string;
  industry: string;
  targetAudience: string;
  goal: string;
  brandStyle: string;
  brandDescription: string;
  result: WebsiteAiOutput | null;
};

type WebsiteProjectRecord = Partial<WebsiteProject>;

export default function WebsiteProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch(
        `/api/projects?userId=${encodeURIComponent(user.uid)}`
      );

      if (!response.ok) {
        throw new Error("Failed to load projects");
      }

      const data = await response.json() as { projects?: WebsiteProjectRecord[] };

      const websiteProjects = (data.projects || []).filter(
        (project) =>
          project.name?.toLowerCase().includes("website project")
      );

      setProjects(websiteProjects as WebsiteProject[]);
    } catch (error) {
      console.error("Website project loading error:", error);
    } finally {
      setLoading(false);
    }
  });

  return () => unsubscribe();
}, []);

  const deleteProject = async (id: string) => {
    try {
      const response = await authenticatedFetch(
        `/api/projects?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

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

  const openProject = (project: WebsiteProject) => {
    router.push(`/dashboard/website-ai?projectId=${encodeURIComponent(project.id)}`);
  };

  return (
    <main className="min-h-screen bg-[#020817] px-8 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold tracking-[0.28em] text-cyan-400">
          PROJECT LIBRARY
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Website Project History
        </h1>

        <p className="mt-3 text-slate-400">
          Open, continue, or remove your saved website projects.
        </p>

        {loading ? (
          <p className="mt-10 text-slate-400">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="mt-10 text-slate-400">
            No website projects saved yet.
          </p>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-[24px] border border-cyan-500/20 bg-slate-900/80 p-6"
              >
                <p className="text-sm font-semibold text-cyan-400">
                  {project.industry || "Website"}
                </p>

                <h2 className="mt-3 text-xl font-bold">
                  {project.name}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  {project.companyName}
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => openProject(project)}
                    className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    Open Project
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
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
