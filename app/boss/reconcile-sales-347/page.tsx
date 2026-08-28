"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

const fixed = {
  projectId: "c704e98b-4b6d-41d6-9ffe-fe7fb926f598",
  runId: "a44f1366-6785-40b2-8aba-bd878b68b36e",
  taskId: "39813208-563c-4007-800b-003c8084f920",
  usageId: "e7c2080d-fc06-4924-a116-d458c7bcd221",
  executionId: "347",
} as const;

export default function ReconcileSales347Page() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(action: "validate" | "reconcile") {
    if (submitting) return;
    setSubmitting(true); setMessage("");
    try {
      const response = await authenticatedFetch("/api/internal/easy-mode/reconcile-sales-347", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fixed, action }),
      });
      const result = await response.json() as { state?: string; runStatus?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Sales reconciliation failed safely.");
      setMessage(`Result: ${result.state}. Run: ${result.runStatus}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sales reconciliation failed safely."); }
    finally { setSubmitting(false); }
  }
  return <main className="mx-auto max-w-xl p-8 text-white">
    <h1 className="text-2xl font-semibold">Sales execution 347 reconciliation</h1>
    <p className="mt-3 text-sm text-slate-300">Boss-admin authentication is required. This reuses only saved execution 347 and never starts Sales again.</p>
    <div className="mt-6 flex gap-3">
      <button type="button" disabled={submitting} onClick={() => void submit("validate")} className="rounded-lg border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 disabled:opacity-50">Validate Sales reconciliation</button>
      <button type="button" disabled={submitting} onClick={() => void submit("reconcile")} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">Reconcile Sales 347</button>
    </div>
    {message ? <p className="mt-5 text-sm text-slate-200">{message}</p> : null}
  </main>;
}
