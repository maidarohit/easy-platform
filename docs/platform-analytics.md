Platform Analytics (Phase 1)
============================

Owners visit `/admin/platform-analytics` and sign in using existing Firebase authentication. Both the server-rendered page and read API verify a Firebase token and use the existing server-only `isBossAdmin` allowlist (`BOSS_ADMIN_UIDS` and `BOSS_ADMIN_UIDS_TEST`). No customer subscription grants access. The page checks authorization before querying or rendering analytics.

Browser navigation uses `/admin/owner-access` to exchange the existing login's bearer token through a same-origin POST for an HttpOnly, SameSite=Strict cookie scoped to `/admin` (Secure in production). The cookie expires with the Firebase token, at most one hour later. Every page request verifies the signed token and current owner allowlist again. Missing/expired authorization redirects server-side to owner access; non-owner authorization returns not found. The read API independently requires the owner's bearer token. Neither cookie presence nor a client redirect grants access.

Apply the additive, idempotent migration to the configured Neon/Postgres database before deployment:

```
node scripts/apply-platform-analytics-migration.mjs
```

This uses `DATABASE_URL` from the environment or `.env.local`. It applies migrations 0032 and 0033, creating only `platform_page_views`, its visitor ID column and indexes; it does not run older pending migrations. This repository's later standalone migrations are not registered in the older Drizzle journal. Historical rows keep NULL visitor IDs because their persistent identity cannot be recovered; they contribute to page views, but not visitors or source visitor totals.

The root layout records initial visits and client pathname changes asynchronously. Admin, boss and API paths are excluded. A random anonymous visitor UUID persists in localStorage and is shared across tabs, sessions and browser restarts. Web Locks serialize initial creation across tabs where supported. Clearing storage or using a different browser creates a new visitor; there is no fingerprinting or cross-device identification. Separate UUID sessions live in sessionStorage, restart after 30 minutes without a tracked visit, and retain entry referrer and UTM attribution. Storage-disabled browsers skip tracking. Visits blocked by browsers or network failures are not retried.

Events contain pathname, referrer origin (no credentials, path, query or fragment), the three bounded UTM fields, anonymous visitor and session IDs and a database-generated UTC timestamp. No name, email, IP address, authenticated user ID or user agent is collected by the tracker. Avoid putting personal information in website pathnames or campaign tags.

Today starts at midnight Asia/Kolkata (18:30 UTC the preceding day). Seven and thirty day windows include today and the preceding six or twenty-nine Kolkata calendar days. The page explicitly labels Asia/Kolkata. Reporting converts these boundaries to UTC instants and excludes future timestamps. All visitor metrics count distinct visitor IDs, regardless of session or tab. Sources and pages show the top ten for the thirty day window. Sources use entry utm_source, then referrer origin, then Direct; source totals count visitors and page totals count views. A visitor can appear under multiple sources across separate sessions.

The public collector accepts same-origin JSON with an 8 KiB limit and caps each session at 60 events per minute using Postgres locks. This limits accidental floods; anonymous analytics is not bot-proof, and determined clients can fabricate sessions. Database failures fail tracking silently and show an unavailable state on the owner dashboard. No customer Analytics AI code is involved.

Focused tests cover persistent visitor reuse, input validation, Kolkata midnight/month/year/leap boundaries, and owner versus customer authorization. The opt-in `platform-analytics-db.test.mjs` runs the actual report queries against a connection-local temporary table, including deduplication, window-edge events, legacy NULL visitor IDs and a non-UTC database session. Enable with `PLATFORM_ANALYTICS_DB_TEST=1` and a configured `DATABASE_URL`; no existing analytics events are modified.
