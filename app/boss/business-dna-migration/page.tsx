"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

export default function BusinessDnaMigrationPage() {
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  async function apply() {
    setRunning(true);
    setStatus("");
    try {
      const response = await authenticatedFetch("/api/internal/boss/business-dna-migration", { method: "POST" });
      const body = await response.json();
      setStatus(response.ok ? `Migration 0016: ${body.state}.` : (body.error ?? "Migration failed."));
    } catch {
      setStatus("Migration failed safely.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white px-6 py-16 text-slate-900">
      <h1 className="text-2xl font-semibold">Business DNA migration 0016</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Boss authentication is required. This creates only the missing additive Business DNA table.</p>
      <button type="button" disabled={running} onClick={apply} className="mt-8 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
        {running ? "Applying safely…" : "Apply migration 0016"}
      </button>
      {status && <p role="status" className="mt-5 rounded-lg bg-slate-100 p-4 text-sm">{status}</p>}
    </main>
  );
}
