"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/app/dashboard/components/Sidebar";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type Report = {
  projectId: string; week: "current" | "previous"; timezone: string;
  period: { start: string; end: string };
  summary: { business: string; businessDna: string; buildStatus: string; savedOutputs: number; preview: string; publication: string; aiRequests: number; subscription: string };
  completedActions: string[]; attention: string[]; nextActions: Array<{ label: string; href: string }>;
  social: Record<string, number>; empty: boolean;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function ReportsContent() {
  const params = useSearchParams();
  const projectId = params.get("projectId")?.trim() ?? "";
  const [week, setWeek] = useState<"current" | "previous">("current");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!projectId) { queueMicrotask(() => { if (active) { setError("Choose a business project to view its report."); setLoading(false); } }); return () => { active = false; }; }
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    void authenticatedFetch(`/api/reports?projectId=${encodeURIComponent(projectId)}&week=${week}`, { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load this report."); if (active) setReport(data as Report); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load this report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, week]);

  return <div className="flex min-h-screen bg-[#F7F3E9] text-[#103C32]"><Sidebar /><main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Business activity</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Weekly Business Report</h1><p className="mt-3 text-[#66756F]">A factual summary using your saved Buzypeezy activity only.</p></div><div className="flex rounded-xl border border-[#D8DCCF] bg-white p-1" aria-label="Report week"><button onClick={() => setWeek("current")} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${week === "current" ? "bg-[#173D32] text-white" : "text-[#173D32]"}`}>Current week</button><button onClick={() => setWeek("previous")} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${week === "previous" ? "bg-[#173D32] text-white" : "text-[#173D32]"}`}>Previous week</button></div></div>
    {loading && <div className="mt-10 rounded-3xl border border-[#DDD8CC] bg-white p-8">Loading your saved activity…</div>}
    {error && <div className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>}
    {!loading && report && <>
      <section className="mt-8 rounded-3xl border border-[#DDD8CC] bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-[#8A713F]">Reporting period · {report.timezone}</p><h2 className="mt-2 text-2xl font-semibold">{formatDate(report.period.start)} – {formatDate(report.period.end)}</h2><p className="mt-2 text-[#66756F]">{report.summary.business}</p></section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Business DNA", report.summary.businessDna], ["Business build", titleCase(report.summary.buildStatus)], ["Preview", report.summary.preview], ["Public business", report.summary.publication], ["Saved outputs", String(report.summary.savedOutputs)], ["Recorded AI requests", String(report.summary.aiRequests)], ["Subscription", titleCase(report.summary.subscription)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#DDD8CC] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8A713F]">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-[#DDD8CC] bg-white p-6"><h2 className="text-2xl font-semibold">Completed actions</h2>{report.completedActions.length ? <ul className="mt-4 space-y-3">{report.completedActions.map((item) => <li key={item} className="rounded-xl bg-[#F4F7F2] p-4">✓ {item}</li>)}</ul> : <p className="mt-4 text-[#66756F]">No completed activity was recorded for this week.</p>}</div><div className="rounded-3xl border border-[#DDD8CC] bg-white p-6"><h2 className="text-2xl font-semibold">Items needing attention</h2>{report.attention.length ? <ul className="mt-4 space-y-3">{report.attention.map((item) => <li key={item} className="rounded-xl bg-[#FFF8E7] p-4">{item}</li>)}</ul> : <p className="mt-4 text-[#66756F]">Nothing needs immediate attention.</p>}</div></section>
      <section className="mt-6 rounded-3xl border border-[#DDD8CC] bg-white p-6"><h2 className="text-2xl font-semibold">Social activity</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(report.social).map(([status, count]) => <div key={status} className="rounded-xl bg-[#F4F7F2] p-4"><p className="text-2xl font-semibold">{count}</p><p className="mt-1 text-sm text-[#66756F]">{titleCase(status)}</p></div>)}</div></section>
      <section className="mt-6 rounded-3xl bg-[#173D32] p-6 text-white"><h2 className="text-2xl font-semibold">Next actions</h2>{report.nextActions.length ? <div className="mt-5 flex flex-wrap gap-3">{report.nextActions.map((action) => <Link key={action.label} href={action.href} className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8C28F]">{action.label}</Link>)}</div> : <p className="mt-3 text-white/75">Keep reviewing your weekly activity as your business grows.</p>}</section>
      {report.empty && <p className="mt-6 rounded-2xl border border-[#DDD8CC] bg-white p-5 text-[#66756F]">There is no recorded activity for this reporting period yet. New activity will appear here automatically.</p>}
    </>}
  </div></main></div>;
}

export default function ReportsPage() { return <Suspense fallback={<div className="min-h-screen bg-[#F7F3E9] p-8">Loading report…</div>}><ReportsContent /></Suspense>; }
