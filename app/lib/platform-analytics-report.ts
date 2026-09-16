import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/app/db";
import { reportingWindow, type PlatformAnalyticsSummary } from "@/app/lib/platform-analytics";

export async function getPlatformAnalytics(now = new Date(), database: Pick<typeof db, "execute"> = db): Promise<PlatformAnalyticsSummary> {
  const window = reportingWindow(now);
  const today = window.today.toISOString();
  const sevenDays = window.sevenDays.toISOString();
  const thirtyDays = window.thirtyDays.toISOString();
  const end = window.end.toISOString();
  const [counts, sources, pages] = await Promise.all([
    database.execute<Pick<PlatformAnalyticsSummary, "visitorsToday" | "pageViewsToday" | "visitors7Days" | "visitors30Days">>(sql`select
      count(distinct visitor_id) filter (where created_at >= ${today}::timestamptz)::int as "visitorsToday",
      count(*) filter (where created_at >= ${today}::timestamptz)::int as "pageViewsToday",
      count(distinct visitor_id) filter (where created_at >= ${sevenDays}::timestamptz)::int as "visitors7Days",
      count(distinct visitor_id)::int as "visitors30Days"
      from platform_page_views where created_at >= ${thirtyDays}::timestamptz and created_at <= ${end}::timestamptz`),
    database.execute<{ label: string; count: number }>(sql`select coalesce(utm_source, referrer, 'Direct') as label, count(distinct visitor_id)::int as count
      from platform_page_views where created_at >= ${thirtyDays}::timestamptz and created_at <= ${end}::timestamptz and visitor_id is not null
      group by 1 order by count desc, label asc limit 10`),
    database.execute<{ label: string; count: number }>(sql`select pathname as label, count(*)::int as count
      from platform_page_views where created_at >= ${thirtyDays}::timestamptz and created_at <= ${end}::timestamptz
      group by pathname order by count desc, label asc limit 10`),
  ]);
  return { ...counts[0], topSources: Array.from(sources), topPages: Array.from(pages) };
}
