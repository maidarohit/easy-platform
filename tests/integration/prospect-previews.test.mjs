import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authorizeProspectRequest, buildProspectDraft, hashProspectValue, newProspectPreviewToken,
  PROSPECT_OWNER_ID, prospectPreviewAccessible, prospectWebsitePayload, validateProspectInput } from "../../app/lib/prospect-preview-core.ts";
import { handleProspectPreview } from "../../app/lib/prospect-preview-handler.ts";
import { createProspectPreviewStore } from "../../app/lib/prospect-preview-store.ts";
import { generateWebsiteAi } from "../../app/lib/website-ai-generation.ts";
import { parsePageView } from "../../app/lib/platform-analytics.ts";

const source = path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const payload = { companyName: "Example Studio", website: "https://example.test", businessDescription: "Ceramic bowls made in small batches.", services: ["Pottery workshops"] };
const output = {
  websiteOverview: "Invented award winner since 1900", websiteGoal: "Buy invented products",
  recommendedPages: "Invented services", siteStructure: "Home and Services", websiteFeatures: "Invented service",
  designRecommendations: "Invented guarantees", colourScheme: "#123456 #abcdef", typography: "Inter",
  recommendedTechStack: "Next.js", seoRecommendations: "Invented claim",
};
const secret = "test-only-secret-not-a-real-credential";
const request = (body = payload, key = "prospect-request-1", token = secret) => new Request("https://app.test/api/internal/prospect-previews", {
  method: "POST", headers: { "content-type": "application/json", "idempotency-key": key, authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});

function fakeDependencies(generate) {
  const records = new Map();
  const saved = [];
  let calls = 0;
  return {
    saved, records, calls: () => calls,
    configuration: () => ({ origin: "https://app.test", webhook: { url: "https://workflow.test", headers: {} } }),
    generate: async () => { calls++; if (generate) return generate(); return { ok: true, responseText: JSON.stringify({ output }) }; },
    store: {
      rateLimit: async () => 0,
      claim: async (key, hash) => {
        const old = records.get(key);
        if (old) return old.payloadHash === hash ? { kind: "existing", record: old } : { kind: "conflict" };
        const record = { id: randomUUID(), projectId: randomUUID(), status: "processing", payloadHash: hash, expiresAt: null, revokedAt: null };
        records.set(key, record);
        return { kind: "created", record };
      },
      finish: async (record, draft, tokenHash, expiresAt) => { saved.push({ draft, tokenHash }); Object.assign(record, { status: "ready", expiresAt }); return true; },
      fail: async (record, category) => Object.assign(record, { status: "failed", errorCategory: category }),
    },
  };
}

test("internal auth fails closed and does not accept outbound webhook secret", async () => {
  assert.equal(authorizeProspectRequest(request(), ""), false);
  assert.equal(authorizeProspectRequest(request(), "different"), false);
  assert.equal(authorizeProspectRequest(request(), secret), true);
  const prior = process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN;
  try {
    delete process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN;
    const deps = fakeDependencies();
    assert.equal((await handleProspectPreview(request(), deps)).status, 401);
    process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN = secret;
    assert.equal((await handleProspectPreview(request(payload, "request-1", "wrong"), deps)).status, 401);
    assert.equal(deps.records.size, 0);
    assert.equal(deps.calls(), 0);
  } finally { if (prior === undefined) delete process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN; else process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN = prior; }
});

test("strict validation rejects malformed, oversized, unknown and unsafe fields", () => {
  assert.ok(validateProspectInput(payload));
  for (const value of [null, [], {}, { ...payload, website: "javascript:alert(1)" },
    { ...payload, website: "https://user:password@example.test" }, { ...payload, email: "not-an-email" },
    { ...payload, phone: "javascript:alert(1)" }, { ...payload, brandStyle: null },
    { ...payload, services: null }, { ...payload, services: Array(13).fill("service") },
    { ...payload, companyName: "x".repeat(201) }, { ...payload, services: ["<script>bad</script>"] }]) {
    assert.equal(validateProspectInput(value), null);
  }
  for (const key of ["projectId", "userId", "ownerId", "webhookUrl", "published", "__proto__"]) {
    assert.equal(validateProspectInput({ ...payload, [key]: "forbidden" }), null);
  }
});

test("mapping treats creative guidance as unverified and never passes caller identity", () => {
  const mapped = prospectWebsitePayload(validateProspectInput({ ...payload, businessType: "Ceramics", mainOpportunity: "Offer impossible guarantee", previewAngle: "Invent awards" }));
  assert.equal(mapped.industry, "Ceramics");
  assert.match(mapped.brandDescription, /Design guidance only, not verified business facts/);
  assert.equal(mapped.projectId, undefined);
  assert.equal(mapped.userId, undefined);
});

test("factual boundary removes ALL generated claims, media, links and contacts", () => {
  const input = validateProspectInput({ ...payload, mainOpportunity: "Unverified strategy", phone: "+1 555 0100" });
  const draft = buildProspectDraft(input, { output });
  assert.ok(draft);
  const serialized = JSON.stringify(draft);
  assert.doesNotMatch(serialized, /Invented|1900|Unverified strategy/);
  assert.match(serialized, /Pottery workshops/);
  assert.equal(draft.siteDocument.theme.colorPalette, "#123456 #abcdef");
  assert.equal(draft.siteDocument.pages.length, 1);
  assert.equal(draft.prospectRender.mode, "authored");
  assert.ok(draft.siteDocument.pages[0].blocks.some(block => block.type === "services"));
  assert.equal(draft.siteDocument.footer.showContact, false);
  assert.equal(buildProspectDraft(input, { output: {} }), null);
});

test("handler: concurrent duplicate, retry and changed payload never regenerate", async () => {
  process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN = secret;
  let resolve;
  const deps = fakeDependencies(() => new Promise(done => { resolve = done; }));
  const first = handleProspectPreview(request(), deps);
  while (!resolve) await new Promise(done => setImmediate(done));
  const pending = await handleProspectPreview(request(), deps);
  assert.equal(pending.status, 202);
  resolve({ ok: true, responseText: JSON.stringify({ output }) });
  const response = await first;
  assert.equal(response.status, 201);
  const issued = await response.json();
  assert.deepEqual(Object.keys(issued).sort(), ["expiresAt", "previewUrl", "requestId", "status"]);
  const token = issued.previewUrl.split("/").at(-1);
  assert.equal(deps.saved[0].tokenHash, hashProspectValue(token));
  assert.ok(!JSON.stringify(deps.saved).includes(token));
  const duplicate = await handleProspectPreview(request(), deps);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).previewUrl, undefined);
  const changed = await handleProspectPreview(request({ ...payload, companyName: "Different" }), deps);
  assert.equal(changed.status, 409);
  assert.equal(deps.calls(), 1);
  assert.equal(deps.records.size, 1);
  assert.equal(deps.saved.length, 1);
});

test("handler validates body, idempotency and durable quota responses before generation", async () => {
  process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN = secret;
  const deps = fakeDependencies();
  assert.equal((await handleProspectPreview(request({ ...payload, ownerId: "customer" }), deps)).status, 400);
  assert.equal((await handleProspectPreview(request(payload, ""), deps)).status, 400);
  const broken = request();
  const invalidJson = new Request(broken.url, { method: "POST", headers: broken.headers, body: "{" });
  assert.equal((await handleProspectPreview(invalidJson, deps)).status, 400);
  assert.equal((await handleProspectPreview(request({ ...payload, businessDescription: "x".repeat(17000) }), deps)).status, 413);
  deps.store.rateLimit = async () => 30;
  const limited = await handleProspectPreview(request(), deps);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "30");
  assert.equal(deps.calls(), 0);
  deps.store.rateLimit = async () => 0;
  deps.store.claim = async () => ({ kind: "limited", retryAfter: 180 });
  assert.equal((await handleProspectPreview(request(), deps)).status, 429);
  assert.equal(deps.calls(), 0);
});

test("upstream and invalid output failures persist safe status, never expose/log bodies or retry generation", async () => {
  process.env.INTERNAL_PROSPECT_PREVIEW_TOKEN = secret;
  const originalLog = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    for (const generation of [async () => { throw new Error("SECRET-UPSTREAM-TEXT"); }, async () => ({ ok: true, responseText: "{}" })]) {
      const deps = fakeDependencies(generation);
      const response = await handleProspectPreview(request(), deps);
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /SECRET|UPSTREAM|stack/);
      assert.equal([...deps.records.values()][0].status, "failed");
      assert.equal((await handleProspectPreview(request(), deps)).status, 409);
      assert.equal(deps.calls(), 1);
      assert.equal(deps.saved.length, 0);
    }
    assert.doesNotMatch(JSON.stringify(logs), /SECRET-UPSTREAM-TEXT|test-only-secret/);
  } finally { console.error = originalLog; }
});

test("tokens are random and hashed; expired/revoked/not-ready previews are inaccessible", () => {
  const a = newProspectPreviewToken(), b = newProspectPreviewToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashProspectValue(a.token));
  const ready = { status: "ready", expiresAt: new Date(Date.now() + 60000), revokedAt: null };
  assert.equal(prospectPreviewAccessible(ready), true);
  assert.equal(prospectPreviewAccessible({ ...ready, expiresAt: new Date(0) }), false);
  assert.equal(prospectPreviewAccessible({ ...ready, revokedAt: new Date() }), false);
  assert.equal(prospectPreviewAccessible({ ...ready, status: "processing" }), false);
});

test("loader diagnostics distinguish every stage without logging credentials, hashes, output or exceptions", async () => {
  const { token, hash } = newProspectPreviewToken();
  const requestId = randomUUID();
  const draft = buildProspectDraft(validateProspectInput(payload), { output });
  const ready = {
    record: { id: requestId, status: "ready", expiresAt: new Date(Date.now() + 60000), revokedAt: null },
    project: { id: "internal-project" }, output: { id: "saved-output", result: JSON.stringify(draft) }, databaseAccessible: true,
  };
  const mockDatabase = (row, throws = false) => ({ select: () => {
    const query = {
      from: () => query, leftJoin: () => query, where: () => query,
      limit: async () => {
        if (throws) throw new Error(`Sensitive exception: ${token} ${hash} Authorization: Bearer hidden-secret ${JSON.stringify(draft)}`);
        return row ? [row] : [];
      },
    };
    return query;
  } });
  const originalInfo = console.info, originalWarn = console.warn;
  let events = [];
  console.info = console.warn = (message, event) => { assert.equal(message, "Prospect preview load."); events.push(event); };
  try {
    const document = await createProspectPreviewStore(mockDatabase(ready)).load(token);
    assert.ok(document.document);
    assert.equal(document.render.mode, "authored");
    assert.deepEqual(events.map(event => event.stage), ["token_received", "token_hash_calculated", "preview_row_lookup",
      "expiry_revocation_check", "project_lookup", "project_output_lookup", "draft_parse_validation", "renderer_data_ready"]);
    assert.ok(events.every(event => event.success));
    assert.ok(events.slice(2).every(event => event.requestId === requestId));
    const { prospectRender: _render, ...legacyDraft } = draft;
    void _render;
    const legacy = await createProspectPreviewStore(mockDatabase({ ...ready, output: { ...ready.output, result: JSON.stringify(legacyDraft) } })).load(token);
    assert.equal(legacy.render, null);
    assert.deepEqual(legacy.document, draft.siteDocument);
    for (const [row, stage, category, throws, candidate = token] of [
      [{ ...ready, output: { ...ready.output, result: JSON.stringify({ ...draft, prospectRender: { version: 99 } }) } }, "draft_parse_validation", "invalid_render_metadata"],
      [ready, "token_received", "invalid_token_format", false, "invalid"],
      [null, "preview_row_lookup", "not_found"],
      [ready, "preview_row_lookup", "database_lookup_error", true],
      [{ ...ready, databaseAccessible: false }, "expiry_revocation_check", "expired_or_invalid_expiry"],
      [{ ...ready, record: { ...ready.record, expiresAt: new Date(0) } }, "expiry_revocation_check", "expired_or_invalid_expiry"],
      [{ ...ready, record: { ...ready.record, revokedAt: new Date() } }, "expiry_revocation_check", "revoked"],
      [{ ...ready, record: { ...ready.record, status: "processing" } }, "expiry_revocation_check", "not_ready"],
      [{ ...ready, project: null }, "project_lookup", "missing_or_unauthorized_project"],
      [{ ...ready, output: null }, "project_output_lookup", "missing_or_unauthorized_output"],
      [{ ...ready, output: { ...ready.output, result: "not JSON" } }, "draft_parse_validation", "draft_parse_or_validation_error"],
      [{ ...ready, output: { ...ready.output, result: "{}" } }, "draft_parse_validation", "invalid_site_document"],
    ]) {
      events = [];
      assert.equal(await createProspectPreviewStore(mockDatabase(row, throws)).load(candidate), null);
      assert.equal(events.at(-1).stage, stage);
      assert.equal(events.at(-1).success, false);
      assert.equal(events.at(-1).category, category);
      assert.ok(events.every(event => Object.keys(event).every(key => ["requestId", "stage", "success", "category"].includes(key))));
      const logged = JSON.stringify(events);
      assert.ok(!logged.includes(token) && !logged.includes(hash));
      assert.doesNotMatch(logged, /Authorization|hidden-secret|websiteOverview|Ceramic bowls|Sensitive exception/);
    }
  } finally { console.info = originalInfo; console.warn = originalWarn; }
});

test("shared transport preserves customer request contract and upstream metadata", async () => {
  let captured;
  const result = await generateWebsiteAi({ url: "https://workflow.test", headers: { "X-Buzypeezy-Webhook-Secret": "outbound-only" } }, { companyName: "Studio" }, {
    fetcher: async (url, init) => {
      captured = { url, init };
      return new Response('{"output":{}}', { headers: { "x-easy-n8n-execution-id": "1234" } });
    },
  });
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.cache, "no-store");
  assert.equal(captured.init.headers["X-Buzypeezy-Webhook-Secret"], "outbound-only");
  assert.deepEqual(JSON.parse(captured.init.body), { companyName: "Studio" });
  assert.equal(result.responseText, '{"output":{}}');
  assert.equal(result.n8nExecutionId, "1234");
  await assert.rejects(generateWebsiteAi({ url: "https://workflow.test", headers: {} }, {}, {
    maxResponseBytes: 4, fetcher: async () => new Response("too long"),
  }), /TOO_LARGE/);
  await assert.rejects(generateWebsiteAi({ url: "https://workflow.test", headers: {} }, {}, {
    timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  }), /aborted/);
});

test("customer isolation and no publication writes; privacy and renderer side-effect guards", async () => {
  const [store, route, page, config, tracker, layout, analytics] = await Promise.all([
    source("app/lib/prospect-preview-store.ts"), source("app/api/website-ai/route.ts"),
    source("app/prospect-preview/[token]/page.tsx"), source("next.config.ts"),
    source("app/components/PlatformPageTracker.tsx"), source("app/layout.tsx"), source("app/components/PrivacyAwareAnalytics.tsx"),
  ]);
  assert.ok(PROSPECT_OWNER_ID.length > 128);
  assert.doesNotMatch(store, /(?:insert|update)\((?:businessPublications|publishedWebsites|websitePublicationVersions|businessPublicationVersions)\)/);
  assert.doesNotMatch(store, /\.update\(projects\)|checkUsageAllowance\(|startAiUsage\(|claimFreeWebsitePreview\(/);
  assert.match(store, /pg_advisory_xact_lock/);
  assert.match(store, /eq\(projects.userId, PROSPECT_OWNER_ID\)/);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /checkUsageAllowance\(uid, "websiteGenerations"\)/);
  assert.match(route, /startAiUsage/);
  assert.match(route, /claimFreeWebsitePreview/);
  assert.match(route, /persistSuccessfulFreeWebsitePreview/);
  assert.match(route, /associateN8nExecution/);
  assert.match(page, /<ProspectConcept document=\{document\} render=\{render\}/);
  assert.match(page, /createProspectPreviewStore\(\)\.load\(token\)/);
  assert.match(page, /if \(!snapshot\) notFound\(\)/);
  assert.doesNotMatch(page, /editorMode=/);
  assert.match(config, /private, no-store/);
  assert.match(config, /noindex, nofollow, noarchive/);
  assert.match(config, /no-referrer/);
  assert.match(tracker, /prospect-preview/);
  assert.match(layout, /NonProspectOnly/);
  assert.match(analytics, /beforeSend/);
  const view = { visitorId: randomUUID(), sessionId: randomUUID(), pathname: "/prospect-preview/secret" };
  assert.equal(parsePageView(view), null);
  assert.ok(parsePageView({ ...view, pathname: "/dashboard" }));
});
