import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authorizePlatformOwnerCookie, OWNER_COOKIE } from "@/app/lib/platform-analytics-owner";
import { getPlatformAnalytics } from "@/app/lib/platform-analytics-report";

export const dynamic = "force-dynamic";

export default async function PlatformAnalyticsPage() {
  const access = await authorizePlatformOwnerCookie((await cookies()).get(OWNER_COOKIE)?.value);
  if (access.status === 401) redirect("/admin/owner-access");
  if (access.status !== 200) notFound();
  let data;
  try {
    data = await getPlatformAnalytics();
  } catch {
    return <main className="p-8"><p role="status">Platform analytics is temporarily unavailable. Please try again.</p></main>;
  }

  return <main className="mx-auto w-full max-w-6xl space-y-8 p-6 md:p-10">
    <div><p className="text-sm text-slate-500">Buzypeezy · Owner administration</p><h1 className="mt-2 text-3xl font-semibold">Platform Analytics</h1>
      <p className="mt-3 text-sm text-slate-500">Visitors are distinct anonymous browser IDs, shared across tabs and visits. Reporting timezone: Asia/Kolkata. The 7-day and 30-day windows include today.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {([
        ["Visitors today", data.visitorsToday], ["Page views today", data.pageViewsToday],
        ["Visitors last 7 days", data.visitors7Days], ["Visitors last 30 days", data.visitors30Days],
      ] as const).map(([label, count]) => <section key={label} className="rounded-xl border border-slate-200 p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-3xl font-semibold">{count.toLocaleString()}</p></section>)}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Ranking title="Top traffic sources" column="Source" metric="Visitors" rows={data.topSources} />
      <Ranking title="Top pages" column="Pathname" metric="Page views" rows={data.topPages} />
    </div>
  </main>;
}

function Ranking({ title, column, metric, rows }: { title: string; column: string; metric: string; rows: Array<{ label: string; count: number }> }) {
  return <section className="min-w-0 rounded-xl border border-slate-200 p-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mb-4 text-sm text-slate-500">Last 30 days</p>
    {rows.length === 0 ? <p className="text-slate-500">No visits recorded yet.</p> : <table className="w-full text-left text-sm"><thead><tr><th scope="col" className="pb-3">{column}</th><th scope="col" className="pb-3 text-right">{metric}</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.label} className="border-t border-slate-200"><td className="break-all py-3 pr-4">{row.label}</td><td className="text-right">{row.count.toLocaleString()}</td></tr>)}
    </tbody></table>}
  </section>;
}
