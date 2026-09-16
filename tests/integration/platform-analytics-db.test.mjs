import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getPlatformAnalytics } from "../../app/lib/platform-analytics-report.ts";

test("Postgres report deduplicates visitors across sessions at Kolkata window boundaries", { skip: process.env.PLATFORM_ANALYTICS_DB_TEST !== "1" }, async () => {
  const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
  try {
    await drizzle(client).transaction(async (tx) => {
      // A connection-local temporary table shadows the real table; no production events are changed.
      await tx.execute(sql`create temporary table platform_page_views (
        visitor_id uuid, session_id uuid, pathname text, referrer text, utm_source text, created_at timestamptz
      ) on commit drop`);
      await tx.execute(sql`set local timezone = 'America/New_York'`);
      const visitor = randomUUID();
      const insert = async (id, time) => tx.execute(sql`insert into platform_page_views values
        (${id}::uuid, ${randomUUID()}::uuid, '/pricing', null, 'newsletter', ${time}::timestamptz)`);
      await insert(visitor, "2026-09-17T18:30:00.000Z");
      await insert(visitor, "2026-09-17T18:31:00.000Z");
      await insert(randomUUID(), "2026-09-17T18:29:59.999Z");
      await insert(randomUUID(), "2026-09-11T18:30:00.000Z");
      await insert(randomUUID(), "2026-09-11T18:29:59.999Z");
      await insert(randomUUID(), "2026-08-19T18:30:00.000Z");
      await insert(randomUUID(), "2026-08-19T18:29:59.999Z");
      await insert(null, "2026-09-17T18:32:00.000Z");
      await insert(randomUUID(), "2026-09-18T00:00:00.001Z");
      const report = await getPlatformAnalytics(new Date("2026-09-18T00:00:00.000Z"), tx);
      assert.deepEqual(report, {
        visitorsToday: 1, pageViewsToday: 3, visitors7Days: 3, visitors30Days: 5,
        topSources: [{ label: "newsletter", count: 5 }], topPages: [{ label: "/pricing", count: 7 }],
      });
    });
  } finally { await client.end(); }
});
