"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

const RUN_ID = "5b327c31-dc34-4a37-aea8-3aef107a828e";
const PROJECT_ID = "5e56706a-41e9-498b-bf8a-134fffc8c06f";
const EXECUTION_KEY = "74bb8691-4566-4c00-9c48-c6853a4d81f8";

export default function ReconcileMarketing320Page() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function reconcile() {
    if (!file || submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const responsePayload = JSON.parse(await file.text()) as unknown;
      const response = await authenticatedFetch("/api/internal/easy-mode/reconcile-marketing-320", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: RUN_ID, projectId: PROJECT_ID, executionKey: EXECUTION_KEY, response: responsePayload }),
      });
      const result = await response.json() as { state?: string; nextModule?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error || "Reconciliation failed safely.");
      setMessage(`Result: ${result.state}. Next task: ${result.nextModule ?? "none"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconciliation failed safely.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-white">
      <h1 className="text-2xl font-semibold">Marketing #320 reconciliation</h1>
      <p className="mt-3 text-sm text-slate-300">Boss-admin authentication is required. Select only the exact saved n8n #320 JSON.</p>
      <input className="mt-6 block text-sm" type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <button className="mt-6 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50" type="button" disabled={!file || submitting} onClick={() => void reconcile()}>
        {submitting ? "Reconciling…" : "Reconcile once"}
      </button>
      {message ? <p className="mt-5 text-sm text-slate-200">{message}</p> : null}
    </main>
  );
}
