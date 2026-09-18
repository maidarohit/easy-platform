# Customer Website Traffic — Phase 1

Customer traffic is independent of owner Platform Analytics and Vercel Analytics. Never add counts from these datasets together. AI generation and its existing visitor-not-measured grounding remain unchanged; the measured Website Traffic panel loads separately at the top of Analytics AI.

## Deployment

Before deploying, run `node scripts/apply-website-traffic-migration.mjs` against the intended `DATABASE_URL`. It reads `.env.local` without overriding inherited configuration. Migration 0034 is additive and idempotent; like recent repository migrations, it has a dedicated runner rather than running the old Drizzle journal. It creates only `website_page_views` and its indexes. Existing data is not backfilled.

## Collection and isolation

The four public page routes mount one tracker after their existing publication checks. Dashboard/editor previews never mount it. The POST `/api/website-traffic/page-view` accepts same-origin JSON up to 4 KiB and resolves the active, accessible publication and actual page on the server. It never accepts client project or owner IDs. An event UUID primary key makes resubmissions idempotent. Database locks enforce at most 60 events per session/publication and 1,000 per publication per minute.

Publication metadata comes from the existing loaders without changing stored publication snapshots. Visitor and session storage keys include publication kind and stable publication ID; republishing does not reset identity. Sessions expire after 30 minutes without a recorded navigation. Browsers without usable storage skip collection. Tracking failures never block public pages.

Only canonical page paths, anonymous random UUIDs, referrer origins and bounded campaign codes are persisted, plus server-resolved project/publication identity and server timestamps. No IP, user agent, Firebase UID, fingerprint, full referrer URL or query string is stored in this table. Campaign tags reject URLs, email-like strings, whitespace, phone-like numeric strings and overlong values; use campaign codes, never personal information. Session-entry attribution is publication-scoped, with same-origin referrers treated as direct/unknown. Anonymous collection is best effort and is not bot-proof; the origin check is not proof of a human visit.

GET `/api/website-traffic?projectId=...` verifies Firebase authentication and current project ownership before querying. It returns aggregates only with `Cache-Control: private, no-store`. No visitor/session identifiers are exposed. Tests use temporary tables to verify the actual SQL ownership condition and cross-project report isolation.

## Reporting

Today and the inclusive 7/30-day periods use Asia/Kolkata boundaries. Unique visitors count distinct publication/browser identities, not people or devices. Daily unique counts cannot be summed into period unique counts. Top pages, referrer origins and UTM sources count page views; missing source values are labelled explicitly. A project with more than one publication counts their browser identities separately. Tracking starts at rollout; zeros are not invented historical estimates. The panel distinguishes loading, empty periods and request errors, and hides stale data on project/auth changes.

The publication panels link to `/analytics-ai?projectId=...#website-traffic`. Access to measured traffic does not require an AI generation request.

## Verification

```
node --experimental-strip-types --experimental-loader ./tests/typescript-loader.mjs --test tests/integration/website-traffic.test.mjs tests/integration/website-traffic-client.test.mjs
```

For actual SQL checks, set `WEBSITE_TRAFFIC_DB_TEST=1`, load the intended `DATABASE_URL`, and run `tests/integration/website-traffic-db.test.mjs` with the same Node flags. This creates connection-local temporary tables shadowing the production tables and writes no real customer events or projects. Run `npm run build` afterward. On memory-constrained development machines, `CIRCLE_NODE_TOTAL=2` limits this Next.js version to one build worker without changing repository configuration.
