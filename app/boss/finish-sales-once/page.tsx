"use client";

import { useRef, useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

const RUN_ID = "319cbe1c-efa0-4288-b644-48fd92b48b9e";
const EXECUTE_ENDPOINT = `/api/easy-mode/runs/${RUN_ID}/execute-next`;

type Validation = Readonly<{ valid: true; runStatus: "running"; salesStatus: "queued"; completedTasks: 6; providerCallsOnRun: 1 }>;
type Execution = Readonly<{
  state?: string;
  message?: string;
  progress?: { runStatus?: string; tasks?: readonly { label: string; status: string }[] };
}>;

export default function FinishSalesOncePage() {
  const inFlight = useRef(false);
  const salesRequestSent = useRef(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [salesAttempted, setSalesAttempted] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ salesStatus: string; runStatus: string } | null>(null);

  async function validateOnly() {
    if (inFlight.current || salesRequestSent.current) return;
    inFlight.current = true; setBusy(true); setValidation(null); setMessage("");
    try {
      const response = await authenticatedFetch("/api/internal/easy-mode/finish-sales-once", { cache: "no-store" });
      const data = await response.json() as Validation & { error?: string };
      if (!response.ok || data.valid !== true) throw new Error(data.error || "Sales-only validation failed safely.");
      setValidation(data);
      setMessage("Validated: six tasks are complete and Sales is the only queued task.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sales-only validation failed safely.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function runSalesOnce() {
    if (inFlight.current || salesRequestSent.current || !validation?.valid) return;
    inFlight.current = true;
    salesRequestSent.current = true;
    setSalesAttempted(true);
    setBusy(true); setMessage("Running Sales once…");
    try {
      const response = await authenticatedFetch(EXECUTE_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await response.json() as Execution & { error?: string };
      if (!response.ok) throw new Error(data.error || data.message || "Sales did not complete safely.");
      const sales = data.progress?.tasks?.find((task) => task.label === "Sales");
      setResult({ salesStatus: sales?.status ?? (data.state === "completed" ? "Completed" : "Unknown"), runStatus: data.progress?.runStatus ?? data.state ?? "Unknown" });
      setMessage(data.message || "Sales request completed.");
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : "Sales did not complete safely."} No second request will be sent from this page.`);
    } finally { inFlight.current = false; setBusy(false); setValidation(null); }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Boss-only production action</p>
        <h1 className="mt-3 text-3xl font-semibold">Finish Sales once</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">Fixed existing run: {RUN_ID}. Validate immediately before sending the one Sales request.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={busy || salesAttempted} onClick={() => void validateOnly()} className="min-h-12 rounded-lg border border-cyan-400 px-5 font-semibold text-cyan-200 disabled:opacity-40">Validate Sales only</button>
          <button type="button" disabled={busy || !validation?.valid || salesAttempted} onClick={() => void runSalesOnce()} className="min-h-12 rounded-lg bg-cyan-400 px-5 font-semibold text-slate-950 disabled:opacity-40">Run Sales once</button>
        </div>
        {message && <p role="status" className="mt-5 text-sm text-slate-200">{message}</p>}
        {result && <dl className="mt-6 grid gap-3 rounded-xl border border-slate-700 p-4 text-sm"><div><dt className="text-slate-400">Sales status</dt><dd className="font-semibold">{result.salesStatus}</dd></div><div><dt className="text-slate-400">Run status</dt><dd className="font-semibold">{result.runStatus}</dd></div><div><dt className="text-slate-400">Provider call count expectation</dt><dd className="font-semibold">1</dd></div></dl>}
      </section>
    </main>
  );
}
