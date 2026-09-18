import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getWebsiteTraffic, ownedWebsiteTraffic } from '../../app/lib/website-traffic-report.ts';
import { ownsTrafficProject, recordWebsiteTraffic } from '../../app/lib/website-traffic-server.ts';
import { parseWebsiteTraffic } from '../../app/lib/website-traffic.ts';

test('Postgres: ownership, event uniqueness, rate cap, project isolation and Kolkata aggregate boundaries', { skip: process.env.WEBSITE_TRAFFIC_DB_TEST !== '1' }, async () => {
  const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
  try {
    await drizzle(client).transaction(async tx => {
      // Connection-local tables shadow real tables. Never insert production analytics or projects.
      await tx.execute(sql`create temporary table website_page_views (like public.website_page_views including all) on commit drop`);
      await tx.execute(sql`create temporary table projects (id text primary key, user_id text) on commit drop`);
      await tx.execute(sql`insert into projects values ('project-a', 'owner-a'), ('project-b', 'owner-b')`);
      await tx.execute(sql`set local timezone = 'America/New_York'`);
      assert.equal(await ownsTrafficProject('owner-a', 'project-a', tx), true);
      assert.equal(await ownsTrafficProject('owner-a', 'project-b', tx), false);
      let queried = false;
      assert.equal(await ownedWebsiteTraffic('owner-a', 'project-b', { owns: (uid,id) => ownsTrafficProject(uid,id,tx), report: async () => { queried=true; } }), null);
      assert.equal(queried,false);
      const publication = { projectId: 'project-a', publicationId: randomUUID() };
      const event = parseWebsiteTraffic({ eventId: randomUUID(), visitorId: randomUUID(), sessionId: randomUUID(), kind: 'business', slug: 'studio', pagePath: '/' });
      assert.equal(await recordWebsiteTraffic(event, publication, tx), 'recorded');
      assert.equal(await recordWebsiteTraffic(event, publication, tx), 'duplicate');
      const [count] = await tx.execute(sql`select count(*)::int as n from website_page_views`); assert.equal(count.n,1);
      await tx.execute(sql`insert into website_page_views (event_id,project_id,publication_kind,publication_id,page_path,visitor_id,session_id)
        select gen_random_uuid(),'project-a','business',${publication.publicationId}::uuid,'/',${event.visitorId}::uuid,${event.sessionId}::uuid from generate_series(1,59)`);
      assert.equal(await recordWebsiteTraffic({ ...event, eventId: randomUUID() }, publication, tx), 'limited');
      await tx.execute(sql`truncate website_page_views`);
      const now=new Date('2026-09-18T00:00:00Z');
      const insert = async (visitor,time,project='project-a') => tx.execute(sql`insert into website_page_views
        (event_id,project_id,publication_kind,publication_id,page_path,visitor_id,session_id,referrer_origin,utm_source,created_at)
        values (${randomUUID()}::uuid,${project},'business',${publication.publicationId}::uuid,'/',${visitor}::uuid,${randomUUID()}::uuid,'https://search.test','search',${time}::timestamptz)`);
      const visitor=randomUUID();
      await insert(visitor,'2026-09-17T18:30:00Z'); await insert(visitor,'2026-09-17T18:31:00Z');
      await insert(randomUUID(),'2026-09-17T18:29:59.999Z');
      await insert(randomUUID(),'2026-09-11T18:30:00Z');
      await insert(randomUUID(),'2026-09-11T18:29:59.999Z');
      await insert(randomUUID(),'2026-08-19T18:30:00Z');
      await insert(randomUUID(),'2026-08-19T18:29:59.999Z');
      await insert(randomUUID(),'2026-09-18T00:00:00.001Z');
      await insert(randomUUID(),'2026-09-17T18:30:00Z','project-b');
      const report=await getWebsiteTraffic('project-a',now,tx);
      assert.equal(report.visitorsToday,1); assert.equal(report.pageViewsToday,2);
      assert.equal(report.visitors7Days,3); assert.equal(report.pageViews7Days,4);
      assert.equal(report.visitors30Days,5); assert.equal(report.pageViews30Days,6);
      assert.equal(report.daily.length,30); assert.deepEqual(report.daily.at(-1),{day:'2026-09-18',visitors:1,pageViews:2});
      assert.deepEqual(report.periods['7'].pages,[{label:'/',count:4}]);
      assert.deepEqual(report.periods['30'].referrers,[{label:'https://search.test',count:6}]);
      assert.deepEqual(report.periods['30'].sources,[{label:'search',count:6}]);
      const empty=await getWebsiteTraffic('empty-project',now,tx);assert.equal(empty.pageViews30Days,0);assert.ok(empty.daily.every(day=>day.pageViews===0));
    });
  } finally { await client.end(); }
});
