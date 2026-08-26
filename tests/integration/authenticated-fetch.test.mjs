import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticatedFetchWithAuth } from "../../app/lib/authenticated-fetch.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("authenticated requests wait for delayed Firebase hydration and then attach the restored token", async () => {
  const events = [];
  const user = { async getIdToken(forceRefresh) { events.push(`token:${Boolean(forceRefresh)}`); return "restored-token"; } };
  const auth = {
    currentUser: null,
    onAuthStateChanged() { return () => {}; },
    async authStateReady() {
      events.push("ready:start");
      await Promise.resolve();
      this.currentUser = user;
      events.push("ready:complete");
    },
  };
  const response = await authenticatedFetchWithAuth(auth, async (_input, init) => {
    events.push(`fetch:${new Headers(init?.headers).get("Authorization")}`);
    return new Response("ok");
  }, "/api/business-preview");

  assert.equal(response.status, 200);
  assert.deepEqual(events, ["ready:start", "ready:complete", "token:false", "fetch:Bearer restored-token"]);
});

test("a restored stale token is refreshed once after 401 without weakening server authorization", async () => {
  const tokenCalls = [];
  const auth = {
    currentUser: { async getIdToken(forceRefresh) { tokenCalls.push(Boolean(forceRefresh)); return forceRefresh ? "fresh" : "stale"; } },
    async authStateReady() {},
    onAuthStateChanged() { return () => {}; },
  };
  const authorizations = [];
  const response = await authenticatedFetchWithAuth(auth, async (_input, init) => {
    const authorization = new Headers(init?.headers).get("Authorization");
    authorizations.push(authorization);
    return new Response(null, { status: authorization === "Bearer fresh" ? 200 : 401 });
  }, "/api/business-preview");

  assert.equal(response.status, 200);
  assert.deepEqual(tokenCalls, [false, true]);
  assert.deepEqual(authorizations, ["Bearer stale", "Bearer fresh"]);
});

test("a genuinely logged-out user fails only after auth restoration completes", async () => {
  let ready = false;
  let fetched = false;
  const auth = {
    currentUser: null,
    async authStateReady() { await Promise.resolve(); ready = true; },
    onAuthStateChanged(callback) { queueMicrotask(() => callback(null)); return () => {}; },
  };

  await assert.rejects(
    authenticatedFetchWithAuth(auth, async () => { fetched = true; return new Response(); }, "/api/business-preview", {}, 5),
    /Authentication is required\./,
  );
  assert.equal(ready, true);
  assert.equal(fetched, false);
});

test("publish waits through a transient null user and issues the authorized POST after restoration", async () => {
  const events = [];
  let observer = () => {};
  const restored = { async getIdToken(forceRefresh) { events.push(`token:${Boolean(forceRefresh)}`); return "publish-token"; } };
  const auth = {
    currentUser: null,
    async authStateReady() { events.push("ready"); },
    onAuthStateChanged(callback) {
      observer = callback;
      queueMicrotask(() => {
        this.currentUser = restored;
        observer(restored);
      });
      return () => { events.push("unsubscribed"); };
    },
  };
  const requests = [];
  const response = await authenticatedFetchWithAuth(auth, async (input, init) => {
    requests.push({ input, method: init?.method, authorization: new Headers(init?.headers).get("Authorization"), body: init?.body });
    return Response.json({ publication: { status: "active" } });
  }, "/api/business-publications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: "39012ee0-6fea-4841-b99f-793727a045a1" }),
  }, 50);

  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    input: "/api/business-publications",
    method: "POST",
    authorization: "Bearer publish-token",
    body: JSON.stringify({ projectId: "39012ee0-6fea-4841-b99f-793727a045a1" }),
  });
  assert.deepEqual(events, ["ready", "unsubscribed", "token:false"]);
});

test("publish performs no more than one forced refresh and one retry after a real 401", async () => {
  const tokenCalls = [];
  const auth = {
    currentUser: { async getIdToken(forceRefresh) { tokenCalls.push(Boolean(forceRefresh)); return forceRefresh ? "fresh" : "cached"; } },
    async authStateReady() {},
    onAuthStateChanged() { return () => {}; },
  };
  let requests = 0;
  const response = await authenticatedFetchWithAuth(auth, async () => {
    requests += 1;
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }, "/api/business-publications", { method: "POST", body: "{}" });

  assert.equal(response.status, 401);
  assert.equal(requests, 2);
  assert.deepEqual(tokenCalls, [false, true]);
});

test("Business Preview mutations share hydrated auth while public business pages remain auth-free", async () => {
  const [previewPage, previewRoute, editRoute, publicationRoute, publicPage] = await Promise.all([
    source("app/business-preview/page.tsx"),
    source("app/api/business-preview/route.ts"),
    source("app/api/business-preview/edits/route.ts"),
    source("app/api/business-publications/route.ts"),
    source("app/business/[slug]/page.tsx"),
  ]);

  assert.match(previewPage, /authenticatedFetch\(`\/api\/business-preview/);
  assert.match(previewPage, /authenticatedFetch\("\/api\/business-preview\/edits"/);
  assert.match(previewPage, /authenticatedFetch\("\/api\/business-publications"/);
  for (const ownerRoute of [previewRoute, editRoute, publicationRoute]) {
    assert.match(ownerRoute, /verifyFirebaseIdToken\(request\)/);
  }
  assert.doesNotMatch(publicPage, /verifyFirebaseIdToken|authenticatedFetch/);
  assert.doesNotMatch(previewPage, /\/api\/business-build|\/api\/easy-mode|OpenAI|n8n/i);
});
