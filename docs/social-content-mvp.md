# Social & Content MVP

The customer route is `/social?projectId=<project-id>`. Recommendations are
selected deterministically from the latest saved Marketing output, then confirmed
Business DNA as a fallback. No generation workflow is used.

Daily dates use UTC until Buzypeezy has an explicit customer timezone preference.
The `(project_id, local_date)` unique index prevents refresh duplicates.

## OAuth boundary

Target providers are Meta (Instagram/Facebook) and LinkedIn. The intended callback
URI is:

`https://<canonical-host>/api/social/callback`

Initiation and callback require the authenticated Firebase owner and an HMAC-signed,
ten-minute OAuth state. Real OAuth is deliberately unavailable because encrypted
token storage and provider credentials are not configured. No access or refresh
token is accepted or persisted by this MVP.

Before enabling connections, add a managed encrypted secret store (or envelope
encryption with separately managed keys), configure provider applications and exact
redirect URIs, implement server-side code exchange, and add provider-specific token
refresh/revocation. Never add plaintext token columns to `social_connections`.

## Production migration

Apply `drizzle/0019_add-social-content-loop.sql` explicitly to the production Neon
database before testing persisted edits. Vercel deployment does not apply it.
