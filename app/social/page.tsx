"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type Channel = { provider: "meta" | "linkedin"; status: "setup_required" | "connected" | "needs_attention"; accountName?: string | null; message?: string };
type Recommendation = { id: string; content: string; originalContent: string; platform: string; theme?: string | null; recommendedAction?: string | null; status: "proposed" | "approved" | "skipped" | "published" | "failed" };
type SocialData = { timezone: string; channels: Channel[]; recommendation: Recommendation | null; publishingAvailable: boolean };

const channelNames = { meta: "Instagram & Facebook", linkedin: "LinkedIn" } as const;
const stateLabels = { setup_required: "Connection setup required", connected: "Connected", needs_attention: "Needs attention" } as const;

function SocialPageContent() {
  const projectId = useSearchParams().get("projectId")?.trim() ?? "";
  const [data, setData] = useState<SocialData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!projectId) { setError("Choose a business project first."); return; }
    try {
      const response = await authenticatedFetch(`/api/social?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Social & Content.");
      setData(payload as SocialData); setDraft(payload.recommendation?.content ?? "");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load Social & Content."); }
  }, [projectId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(action: "edit" | "approve" | "skip" | "reset" | "publish", content?: string) {
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch("/api/social", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, action, ...(action === "edit" && { content }) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to update today's recommendation.");
      setEditing(false); await load();
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Unable to update today's recommendation."); }
    finally { setBusy(false); }
  }

  async function connect(provider: Channel["provider"]) {
    setBusy(true); setError("");
    try {
      const response = await authenticatedFetch("/api/social/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, provider }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Social publishing setup is not connected yet.");
    } catch (connectionError) { setError(connectionError instanceof Error ? connectionError.message : "Social publishing setup is not connected yet."); }
    finally { setBusy(false); }
  }

  const recommendation = data?.recommendation;
  return <main className="min-h-screen bg-[#F7F4EC] px-5 py-10 text-[#1B211E] sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A713F]">Your daily operating loop</p><h1 className="mt-3 text-4xl font-semibold text-[#0E2C24]">Social &amp; Content</h1><p className="mt-3 text-[#626A64]">Connect channels, review today&apos;s saved idea, and stay in control before anything is published.</p></div><Link href={projectId ? `/master-workspace?projectId=${encodeURIComponent(projectId)}` : "/dashboard"} className="rounded-xl border border-[#173D32]/20 bg-white px-4 py-3 font-semibold text-[#173D32]">Back to My Business</Link></div>
    {error && <p role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{error}</p>}
    <section className="mt-8"><h2 className="text-2xl font-semibold text-[#0E2C24]">Connect Channels</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{(data?.channels ?? ([{ provider: "meta", status: "setup_required" }, { provider: "linkedin", status: "setup_required" }] as Channel[])).map((channel) => <article key={channel.provider} className="rounded-2xl border border-[#173D32]/10 bg-white p-6"><h3 className="text-xl font-semibold">{channelNames[channel.provider]}</h3><p className="mt-2 text-sm font-semibold text-[#8A713F]">{stateLabels[channel.status]}</p>{channel.accountName && <p className="mt-2 text-sm text-[#626A64]">{channel.accountName}</p>}<button disabled={busy || channel.status === "connected"} onClick={() => void connect(channel.provider)} className="mt-5 rounded-xl bg-[#173D32] px-4 py-3 font-semibold text-white disabled:opacity-50">{channel.status === "connected" ? "Connected" : "Set up connection"}</button></article>)}</div></section>
    <section className="mt-8 rounded-[28px] border border-[#173D32]/10 bg-white p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A713F]">Today&apos;s Recommendation</p>{!recommendation ? <p className="mt-4 text-[#626A64]">No saved Marketing or Business DNA idea is available yet.</p> : <><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-[#EDF0E8] px-3 py-1 text-sm font-semibold">{recommendation.platform === "general" ? "Any connected channel" : recommendation.platform}</span>{recommendation.theme && <span className="rounded-full bg-[#F4ECDD] px-3 py-1 text-sm">{recommendation.theme}</span>}<span className="rounded-full border px-3 py-1 text-sm capitalize">{recommendation.status}</span></div>
      {editing ? <label className="mt-5 block"><span className="text-sm font-semibold">Post text</span><textarea value={draft} maxLength={2200} rows={8} onChange={(event) => setDraft(event.target.value)} className="mt-2 w-full rounded-xl border border-[#A8B8A7] p-4 leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]" /><span className="mt-1 block text-right text-xs text-[#626A64]">{draft.length}/2200</span></label> : <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#F7F4EC] p-5 leading-7">{recommendation.content}</p>}
      {recommendation.recommendedAction && <p className="mt-4 text-sm text-[#626A64]">{recommendation.recommendedAction}</p>}
      <div className="mt-6 flex flex-wrap gap-3">{editing ? <><button disabled={busy} onClick={() => void update("edit", draft)} className="rounded-xl bg-[#173D32] px-5 py-3 font-semibold text-white">Save</button><button disabled={busy} onClick={() => { setDraft(recommendation.content); setEditing(false); }} className="rounded-xl border px-5 py-3 font-semibold">Cancel</button><button disabled={busy} onClick={() => void update("reset")} className="rounded-xl px-5 py-3 font-semibold text-[#8A4B3D]">Reset</button></> : recommendation.status === "skipped" ? <button disabled={busy} onClick={() => void update("reset")} className="rounded-xl border px-5 py-3 font-semibold text-[#173D32]">Restore today&apos;s idea</button> : <><button disabled={busy} onClick={() => void update("approve")} className="rounded-xl bg-[#173D32] px-5 py-3 font-semibold text-white">Approve</button><button disabled={busy} onClick={() => setEditing(true)} className="rounded-xl border px-5 py-3 font-semibold">Edit</button><button disabled={busy} onClick={() => void update("skip")} className="rounded-xl border px-5 py-3 font-semibold">Skip today</button><button disabled={busy || recommendation.status !== "approved" || !data?.publishingAvailable} onClick={() => void update("publish")} className="rounded-xl bg-[#8A713F] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{data?.publishingAvailable ? "Publish approved post" : "Connect a channel to publish"}</button></>}</div>
    </>}</section>
    <p className="mt-5 text-center text-xs text-[#7B847E]">Daily date uses UTC until a customer timezone preference is available. Nothing is published automatically.</p>
  </div></main>;
}

export default function SocialPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#F7F4EC] p-10 text-[#173D32]">Loading Social &amp; Content…</main>}><SocialPageContent /></Suspense>;
}
