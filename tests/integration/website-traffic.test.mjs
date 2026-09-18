import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseWebsiteTraffic, trafficCampaign, trafficReferrer, websiteTrafficIdentity } from '../../app/lib/website-traffic.ts';
import { collectWebsiteTraffic } from '../../app/lib/website-traffic-collector.ts';
import { resolveTrafficPublication } from '../../app/lib/website-traffic-server.ts';
import { ownedWebsiteTraffic } from '../../app/lib/website-traffic-report.ts';
import { reportingWindow } from '../../app/lib/platform-analytics.ts';

const event = () => ({ eventId: randomUUID(), kind: 'business', slug: 'studio', pagePath: '/', visitorId: randomUUID(), sessionId: randomUUID() });
const request = (body, origin = 'https://buzypeezy.test') => new Request('https://buzypeezy.test/api/website-traffic/page-view', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('collector resolves server identity and rejects forged ownership, invalid publications and foreign origins', async () => {
  let writes = 0;
  const dependencies = { resolve: async () => ({ projectId: 'server-project', publicationId: randomUUID() }), record: async (value, publication) => { writes++; assert.equal(publication.projectId, 'server-project'); assert.equal(value.projectId, undefined); return 'recorded'; } };
  assert.equal((await collectWebsiteTraffic(request(event()), dependencies)).status, 204);
  assert.equal((await collectWebsiteTraffic(request({ ...event(), projectId: 'victim' }), dependencies)).status, 400);
  assert.equal((await collectWebsiteTraffic(request(event(), 'https://other.test'), dependencies)).status, 403);
  assert.equal((await collectWebsiteTraffic(request(event()), { ...dependencies, resolve: async () => null })).status, 404);
  assert.equal((await collectWebsiteTraffic(request(event()), { ...dependencies, record: async () => 'limited' })).status, 429);
  assert.equal((await collectWebsiteTraffic(request(event()), { ...dependencies, record: async () => 'duplicate' })).status, 204);
  assert.equal(writes, 1);
});

test('publication resolver rejects unavailable publications and missing legacy subpages', async () => {
  const parsed = parseWebsiteTraffic(event());
  const missing = { business: async () => null, website: async () => null };
  assert.equal(await resolveTrafficPublication(parsed, missing), null);
  assert.equal(await resolveTrafficPublication({ ...parsed, kind: 'website' }, missing), null);
  const loaders = { business: async () => ({ projectId: 'a', publicationId: 'b', snapshot: {} }), website: async () => ({ projectId: 'a', publicationId: 'c', snapshot: { schemaVersion: 1 } }) };
  assert.deepEqual(await resolveTrafficPublication(parsed, loaders), { projectId: 'a', publicationId: 'b' });
  assert.equal(await resolveTrafficPublication({ ...parsed, pagePath: '/missing' }, loaders), null);
  assert.equal(await resolveTrafficPublication({ ...parsed, kind: 'website', pagePath: '/missing' }, loaders), null);
  for (const file of ['public-business-publication.ts', 'public-website-publication.ts']) {
    const source = await readFile(new URL(`../../app/lib/${file}`, import.meta.url), 'utf8');
    assert.match(source, /status, "active"/);
    assert.match(source, /hasPaidProductAccess\(row.userId\)/);
  }
});

test('customer A cannot query B aggregates and no report query runs before ownership passes', async () => {
  const calls = [];
  const deps = { owns: async (uid, project) => uid === 'A' && project === 'project-A', report: async (project) => { calls.push(project); return { visitorsToday: 5 }; } };
  assert.equal(await ownedWebsiteTraffic('A', 'project-B', deps), null);
  assert.equal(await ownedWebsiteTraffic('B', 'project-A', deps), null);
  assert.deepEqual(calls, []);
  assert.deepEqual(await ownedWebsiteTraffic('A', 'project-A', deps), { visitorsToday: 5 });
  assert.deepEqual(calls, ['project-A']);
  const route = await readFile(new URL('../../app/api/website-traffic/route.ts', import.meta.url), 'utf8');
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /private, no-store/);
});

test('traffic accepts only canonical routes and sanitizes attribution without retaining private URL data', () => {
  for (const pagePath of ['/about?email=a', '//evil', '/foo/bar/baz', '/about#secret', '/user%40mail']) assert.equal(parseWebsiteTraffic({ ...event(), pagePath }), null);
  assert.equal(trafficReferrer('https://search.test/path?email=private#secret'), 'https://search.test');
  for (const ref of ['javascript:alert(1)', 'https://user:pass@search.test/a', 'http://127.0.0.1/a', 'http://[::1]/a']) assert.equal(trafficReferrer(ref), null);
  assert.equal(trafficCampaign('Newsletter-Spring_26'), 'newsletter-spring_26');
  for (const tag of ['a@b.com', 'phone1234567890', 'call-555-123-4567', 'https://source.test', 'a b', 'x'.repeat(65)]) assert.equal(trafficCampaign(tag), null);
});

test('visitor and session IDs are publication scoped, stable across pages and expire after inactivity', () => {
  const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value) }; };
  const storage = memory(), sessions = memory(), entry = { referrer: 'https://search.test/private?secret=x', search: '?utm_source=search&utm_campaign=launch', origin: 'https://app.test' };
  const a = websiteTrafficIdentity(storage, sessions, 'business:a', entry, 1000);
  const a2 = websiteTrafficIdentity(storage, sessions, 'business:a', { ...entry, search: '?utm_source=wrong' }, 2000);
  const b = websiteTrafficIdentity(storage, sessions, 'business:b', entry, 2000);
  assert.deepEqual(a, a2); assert.notEqual(a.visitorId, b.visitorId); assert.notEqual(a.sessionId, b.sessionId);
  const next = websiteTrafficIdentity(storage, sessions, 'business:a', entry, 2000 + 31*60*1000);
  assert.equal(a.visitorId, next.visitorId); assert.notEqual(a.sessionId, next.sessionId);
  assert.equal(a.referrer, 'https://search.test');
});

test('Kolkata reporting windows include today across year and leap-day boundaries', () => {
  assert.equal(reportingWindow(new Date('2026-12-31T18:30:00Z')).today.toISOString(), '2026-12-31T18:30:00.000Z');
  const window = reportingWindow(new Date('2024-02-29T18:30:00Z'));
  assert.equal(window.today.toISOString(), '2024-02-29T18:30:00.000Z');
  assert.equal(window.sevenDays.toISOString(), '2024-02-23T18:30:00.000Z');
});
