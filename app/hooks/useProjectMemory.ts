"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import auth from "../lib/auth";
import { normalizeProjectMemory, type ProjectMemory } from "../lib/projectMemory";

type ProjectMemoryState = {
  project: ProjectMemory | null;
  projectId: string;
  loading: boolean;
  error: string;
  connected: boolean;
};

export function useProjectMemory(): ProjectMemoryState {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "";
  const [project, setProject] = useState<ProjectMemory | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!projectId) {
      queueMicrotask(() => {
        if (!active) return;
        setProject(null);
        setLoading(false);
        setError("");
      });
      return () => { active = false; };
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      setProject(null);
      setLoading(true);
      setError("");

      if (!user) {
        setLoading(false);
        setError("Please sign in to open this project.");
        return;
      }

      try {
        const response = await fetch(
          `/api/projects?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(user.uid)}`,
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load project.");
        }

        if (!active) return;
        setProject(normalizeProjectMemory(data.project));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load project.");
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [projectId]);

  return {
    project,
    projectId,
    loading,
    error,
    connected: Boolean(projectId && project && !loading && !error),
  };
}
