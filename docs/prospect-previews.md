# Internal prospect previews

This is a view-only, single-page website concept flow. It never calls publication APIs,
customer entitlement helpers, a prospect domain, or OpenAI directly. It uses the
existing Website AI n8n webhook and saves a normalized website draft server-side.

## Deployment

Apply `drizzle/0035_add_prospect_previews.sql` with the normal database migration
process before enabling the endpoint. This additive SQL follows the repository's
standalone migrations after 0018; the older Drizzle journal is not advanced.
No production migration is executed by the application.

Set `INTERNAL_PROSPECT_PREVIEW_TOKEN` to a high-entropy secret (at least 32 random
bytes). This is the only new environment variable. Never prefix it with
`NEXT_PUBLIC_`. Existing `DATABASE_URL`, `N8N_WEBSITE_AI_WEBHOOK_URL`,
`N8N_WEBHOOK_SECRET`, and HTTPS `NEXT_PUBLIC_APP_URL` must already be configured.
The inbound secret is independent of the outbound n8n secret.

The route requests a 180-second Node runtime budget and uses the shared
120-second Website AI fetch timeout. **Before enabling n8n traffic, confirm the
deployment plan, proxy and n8n caller support the 180-second budget.** The local
repository cannot establish account-level hosting limits. If unsupported, do not
enable this route: the next step is a durable pending-job record, a worker with a
lease, a 202 creation response and an authenticated status endpoint. There is no
fire-and-forget execution here.

Confirm the configured Website AI workflow only generates a response and has no
publishing/domain side effects. Workflow exports are not present in this repo.
Ensure deployment/proxy logs redact `/prospect-preview/*` tokens, Authorization
headers and response bodies. Configure n8n to protect or disable execution-data
retention containing the issued URL. The application never logs these values.

## Request

`POST /api/internal/prospect-previews`, with headers:

- `Authorization: Bearer <INTERNAL_PROSPECT_PREVIEW_TOKEN>`
- `Content-Type: application/json`
- `Idempotency-Key: <8-128 characters: letters, digits, underscore, dot, colon, hyphen>`

Required strings: `companyName` (200), `website` (2048; HTTP/S URL without embedded
credentials), `businessDescription` (1500). Optional strings: `businessType` (200),
`targetAudience` (200), `location` (300), `email` (254), `phone` (50), `brandStyle`
(200), `mainOpportunity` (500), `previewAngle` (500). `services` is an optional
array of at most 12 nonempty strings, each at most 160 characters. Limits are in
characters; the complete body is limited to 16 KiB. Nulls and unknown fields are
rejected. Supplied URLs are reference data only and are not fetched.

`mainOpportunity` and `previewAngle` are clearly separated from facts in the
generation payload. The saved and rendered prose comes only from supplied facts;
generated prose, testimonials, statistics, addresses, media and service lists are
discarded. Only bounded hex colors and allowlisted font names are taken from AI.
Existing renderer safety filters may additionally omit unsuitable supplied copy.

### Authored prospect snapshots

New generations save `prospectRender: { version: 1, mode: "authored", ... }`
alongside the v2 `siteDocument` in the existing output JSON. The server composer
uses supplied facts and generic enquiry guidance; strategy may suggest a process
section but never supplies factual claims. Services, FAQ and process sections are
conditional on available input. No n8n workflow change is required.

The authored renderer preserves visible block order, supports section anchors and
native FAQ expansion, and never mounts forms, checkout or editing controls.
Snapshots without render metadata retain the old inert presentation. There is no
database migration or automatic rewriting of existing previews.

Optional `media` accepts `hero`, `about`, `services` and `work`, each a trusted
image URL or an array of up to six URLs. The internal caller is responsible for
source verification. URLs must pass the existing website uploaded-media policy;
arbitrary external website images are rejected. Source assets are not sent to n8n.
Contextual bundled illustrations can decorate a site but are excluded from
portfolio evidence. Missing media uses a text layout. No source scraping or new
image generation runs in this flow.

## Response and retries

A new successful request returns HTTP 201:

```json
{
  "requestId": "request UUID",
  "status": "ready",
  "previewUrl": "https://buzypeezy.ai/prospect-preview/<random-token>",
  "expiresAt": "ISO timestamp"
}
```

Save this response securely: the URL is issued only once. The database stores only
its SHA-256 hash. A same-key, same-normalized-payload retry never generates again:

- Processing: 202 with requestId/status and Retry-After; repeat the same POST.
- Ready: 200 with requestId/status/expiresAt/previewUrlIssued, **without the URL**.
- Failed/interrupted: 409, without retrying generation.
- Expired/revoked: 410, without a new token.
- Different payload for an existing key: 409.

If the original response is lost, the token cannot be recovered. Investigate and
revoke the existing request before intentionally submitting a new key. Do not
automatically switch keys after a timeout. All idempotency records, including
failures, must be retained for the required deduplication period.

Other responses: 401 unauthorized, 400 malformed/invalid input, 413 oversized,
415 wrong content type, 429 rate/quota cap (Retry-After supplied), 502 generation
failure/invalid output, 503 configuration or persistence failure. Failed
generation state is persisted when the database is available; after interruption
an expired reservation is classified as failed on retry. No retry of the same key
will re-run an uncertain upstream request.

## Isolation and quotas

Projects belong to a dedicated database-only owner whose ID is longer than 128
characters. The installed Firebase Admin verifier explicitly rejects subjects
over 128 characters, so this owner cannot be a customer login. The owner row is
created without changing any existing account; an unexpected owner-row collision
fails closed. Server-generated UUIDs are always inserted, never matched by name.

Under PostgreSQL advisory locks, enforce 10 authenticated requests per 60-second
window, 2 simultaneous generation reservations, and 25 generations per rolling
24 hours (including failed attempts). Failure reservations occupy a slot until
their 180-second lease expires to avoid immediate retries after uncertain upstream
delivery. These are explicit internal quotas, not customer billing allowances.
Usage is recorded under workflow `internal-prospect-preview`; token costs are
applied when the webhook supplies usage metadata. Missing metadata leaves the
cost unknown/unreconciled rather than representing a verified zero-cost request.

Links expire after 7 days. Anyone with the link can view it before expiry unless
revoked; no customer/prospect login is needed. Authorized server operations may
call `createProspectPreviewStore().revoke(requestId)`. Alternatively, an operator
can set `revoked_at = now(), token_hash = NULL` on the matching `prospect_previews`
record using the request UUID. There is intentionally no public revocation API.

The preview reads its exact saved output ID, not the latest customer draft. It
has no publishing, editor, checkout, inquiry or contact actions. No publication
rows or public slugs are created. The page is dynamic, non-indexable and private;
both platform analytics collection and Vercel Analytics exclude the route.
Global assistant and billing widgets do not mount there.
