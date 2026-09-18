import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/app/db";
import { reportingWindow, REPORTING_TIMEZONE } from "@/app/lib/platform-analytics";
import type { WebsiteTrafficReport, TrafficRanking } from "@/app/lib/website-traffic";
import { ownsTrafficProject } from "@/app/lib/website-traffic-server";

export async function getWebsiteTraffic(projectId: string, now = new Date(), database: Pick<typeof db, 'execute'> = db): Promise<WebsiteTrafficReport> {
  const window = reportingWindow(now);
  const today = window.today.toISOString(), seven = window.sevenDays.toISOString(), thirty = window.thirtyDays.toISOString(), end = now.toISOString();
  const [counts] = await database.execute<Omit<WebsiteTrafficReport, 'timezone' | 'daily' | 'periods'>>(sql`select
    count(distinct (publication_kind, publication_id, visitor_id)) filter (where created_at >= ${today}::timestamptz)::int as "visitorsToday",
    count(*) filter (where created_at >= ${today}::timestamptz)::int as "pageViewsToday",
    count(distinct (publication_kind, publication_id, visitor_id)) filter (where created_at >= ${seven}::timestamptz)::int as "visitors7Days",
    count(distinct (publication_kind, publication_id, visitor_id))::int as "visitors30Days",
    count(*) filter (where created_at >= ${seven}::timestamptz)::int as "pageViews7Days", count(*)::int as "pageViews30Days"
    from website_page_views where project_id = ${projectId} and created_at >= ${thirty}::timestamptz and created_at <= ${end}::timestamptz`);
  const daily = await database.execute<WebsiteTrafficReport['daily'][number]>(sql`with dates as (
    select generate_series((${thirty}::timestamptz at time zone 'Asia/Kolkata')::date,
      (${today}::timestamptz at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day
  ), totals as (
    select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as views,
      count(distinct (publication_kind, publication_id, visitor_id))::int as visitors
    from website_page_views where project_id = ${projectId} and created_at >= ${thirty}::timestamptz and created_at <= ${end}::timestamptz group by 1
  ) select to_char(dates.day, 'YYYY-MM-DD') as day, coalesce(totals.views,0)::int as "pageViews", coalesce(totals.visitors,0)::int as visitors
    from dates left join totals using(day) order by dates.day`);
  const rankings = async (start: string) => {
    const rank = async (column: 'page_path' | 'referrer_origin' | 'utm_source', fallback: string): Promise<TrafficRanking> => Array.from(await database.execute<{ label: string; count: number }>(sql`
      select coalesce(${sql.identifier(column)}, ${fallback}) as label, count(*)::int as count from website_page_views
      where project_id = ${projectId} and created_at >= ${start}::timestamptz and created_at <= ${end}::timestamptz
      group by 1 order by count desc, label asc limit 10`));
    const [pages, referrers, sources] = await Promise.all([rank('page_path', '/'), rank('referrer_origin', 'Direct / unknown'), rank('utm_source', 'Untagged')]);
    return { pages, referrers, sources };
  };
  const [week, month] = await Promise.all([rankings(seven), rankings(thirty)]);
  return { timezone: REPORTING_TIMEZONE, ...counts, daily: Array.from(daily), periods: { '7': week, '30': month } };
}

export async function ownedWebsiteTraffic(uid: string, projectId: string, dependencies = { owns: ownsTrafficProject, report: getWebsiteTraffic }) {
  return await dependencies.owns(uid, projectId) ? dependencies.report(projectId) : null;
}
