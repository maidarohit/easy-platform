"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import auth from "@/app/lib/auth";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import type { TrafficRanking, WebsiteTrafficReport } from "@/app/lib/website-traffic";

export default function WebsiteTrafficPanel({ projectId }: { projectId: string }) {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ projectId: string; uid: string; data?: WebsiteTrafficReport; error?: string }>({ projectId: '', uid: '' });
  useEffect(() => {
    if (!projectId) return;
    let active = true, sequence = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const request = ++sequence;
      setState({ projectId, uid: user?.uid || '' });
      if (!user) { setState({ projectId, uid: '', error: 'Sign in to view website traffic.' }); return; }
      void authenticatedFetch(`/api/website-traffic?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok || !body.traffic) throw new Error('Website traffic is temporarily unavailable.');
          if (active && request === sequence) setState({ projectId, uid: user.uid, data: body.traffic });
        }).catch(() => { if (active && request === sequence) setState({ projectId, uid: user.uid, error: 'Website traffic is temporarily unavailable.' }); });
    });
    return () => { active = false; sequence++; unsubscribe(); };
  }, [projectId, retry]);
  const current = state.projectId === projectId && state.uid === (auth.currentUser?.uid || '') ? state : null;
  const data = current?.data;
  const rankings = data?.periods[period];
  const daily = data?.daily.slice(-Number(period)) || [];
  const maximum = Math.max(1, ...daily.map((day) => day.pageViews));
  return <section id="website-traffic" aria-label="Website Traffic" className="mb-8 rounded-2xl border border-slate-700 bg-slate-950 p-5 text-white sm:p-7">
    <h2 className="text-2xl font-semibold">Website Traffic</h2>
    <p className="mt-2 text-sm text-slate-400">Measured public website visits. Unique visitors are anonymous browser estimates. Timezone: Asia/Kolkata. Tracking starts from rollout; blocked visits may be missing.</p>
    {!projectId ? <p role="status" className="mt-4">Select a business project to view traffic.</p> : current?.error ? <div role="alert" className="mt-4"><p>{current.error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 rounded border border-slate-500 px-3 py-2">Retry</button></div> : !data ? <p role="status" className="mt-4">Loading website traffic…</p> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Visitors today" value={data.visitorsToday} /><Metric label="Page views today" value={data.pageViewsToday} /></div>
      <div aria-label="Traffic reporting period" className="mt-5 flex gap-2">{(['7','30'] as const).map((days) => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)} className="rounded border border-slate-500 px-4 py-2 aria-pressed:border-emerald-300 aria-pressed:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2">{days} days</button>)}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><Metric label={`Unique visitors — ${period} days`} value={period === '7' ? data.visitors7Days : data.visitors30Days} /><Metric label={`Page views — ${period} days`} value={period === '7' ? data.pageViews7Days : data.pageViews30Days} /></div>
      {data.pageViews30Days === 0 && <p role="status" className="mt-4">No traffic recorded in the last 30 days yet. Share your published website to start collecting visits.</p>}
      <h3 className="mt-6 font-semibold">Daily traffic</h3>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Daily visitors and page views in Asia/Kolkata</caption><thead><tr><th scope="col">Date</th><th scope="col">Visitors</th><th scope="col">Page views</th><th scope="col"><span className="sr-only">Page view trend</span></th></tr></thead><tbody>{daily.map((day) => <tr key={day.day} className="border-t border-slate-800"><th scope="row" className="py-2 font-normal">{day.day}</th><td>{day.visitors}</td><td>{day.pageViews}</td><td className="w-1/3"><div aria-hidden="true" className="h-2 rounded bg-emerald-400" style={{ width: `${day.pageViews / maximum * 100}%` }} /></td></tr>)}</tbody></table></div>
      {rankings && <div className="mt-6 grid gap-6 lg:grid-cols-3"><Ranking title="Top pages" rows={rankings.pages} /><Ranking title="Referrer origins" rows={rankings.referrers} /><Ranking title="UTM sources" rows={rankings.sources} /></div>}
      <p className="mt-4 text-xs text-slate-400">Traffic source totals count page views using session-entry attribution. Daily unique counts must not be added to calculate period uniques.</p>
    </>}
  </section>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-900 p-4"><h3 className="text-sm text-slate-400">{label}</h3><p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p></div>; }
function Ranking({ title, rows }: { title: string; rows: TrafficRanking }) { return <section><h3 className="font-semibold">{title}</h3>{rows.length ? <table className="mt-2 w-full text-left text-sm"><thead><tr><th scope="col">{title === 'Top pages' ? 'Path' : 'Source'}</th><th scope="col" className="text-right">Views</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label} className="border-t border-slate-800"><td className="break-all py-2 pr-3">{row.label}</td><td className="text-right">{row.count}</td></tr>)}</tbody></table> : <p className="mt-2 text-sm text-slate-400">No visits in this period.</p>}</section>; }
