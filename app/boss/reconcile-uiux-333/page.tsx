"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

const PROJECT_ID = "ad98e057-4fe9-4394-97bc-05391efb85d3";
const EXECUTION_ID = "333";

export default function ReconcileUiux333Page() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(dryRun: boolean) {
    if (!file || submitting) return;
    setSubmitting(true); setMessage("");
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const response = await authenticatedFetch("/api/internal/easy-mode/reconcile-uiux-333", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: PROJECT_ID, executionId: EXECUTION_ID, response: payload, dryRun }),
      });
      const result = await response.json() as { state?: string; salesStatus?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Reconciliation failed safely.");
      setMessage(`Result: ${result.state}. Sales remains ${result.salesStatus}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconciliation failed safely.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="mx-auto max-w-xl p-8 text-white">
      <h1 className="text-2xl font-semibold">UIUX execution 333 recovery</h1>
      <p className="mt-3 text-sm text-slate-300">Boss authentication is required. Upload only the saved Respond to Webhook JSON from execution 333. Dry run first.</p>
      <input className="mt-6 block text-sm" type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <div className="mt-6 flex gap-3">
        <button className="rounded-lg border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 disabled:opacity-50" type="button" disabled={!file || submitting} onClick={() => void submit(true)}>Validate only</button>
        <button className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50" type="button" disabled={!file || submitting} onClick={() => void submit(false)}>Reconcile once</button>
      </div>
      {message ? <p className="mt-5 text-sm text-slate-200">{message}</p> : null}
    </main>
  );
}
