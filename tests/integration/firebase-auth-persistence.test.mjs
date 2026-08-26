import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Firebase auth is a single shared singleton with durable browser-local persistence", async () => {
  const [firebase, auth] = await Promise.all([
    source("app/lib/firebase.ts"),
    source("app/lib/auth.ts"),
  ]);

  assert.match(firebase, /getApps\(\)\.length \? getApp\(\) : initializeApp\(firebaseConfig\)/);
  assert.match(auth, /const auth = getAuth\(app\)/);
  assert.match(auth, /setPersistence\(auth, browserLocalPersistence\)/);
  assert.match(auth, /export const authPersistenceReady/);
  assert.doesNotMatch(auth, /browserSessionPersistence|inMemoryPersistence/);
});

test("login and signup await durable persistence before creating a Firebase session", async () => {
  const [login, signup] = await Promise.all([
    source("app/login/page.tsx"),
    source("app/signup/page.tsx"),
  ]);

  assert.match(login, /await authPersistenceReady;\s*const credential = await signInWithEmailAndPassword/s);
  assert.match(signup, /await authPersistenceReady;\s*const userCredential = await createUserWithEmailAndPassword/s);
});

test("direct protected-route requests await persistence restoration before resolving auth state", async () => {
  const [authenticatedFetch, preview] = await Promise.all([
    source("app/lib/authenticated-fetch.ts"),
    source("app/business-preview/page.tsx"),
  ]);

  assert.match(authenticatedFetch, /await authPersistenceReady;\s*return authenticatedFetchWithAuth\(auth, fetch/s);
  assert.match(authenticatedFetch, /await readyAuth\.authStateReady\(\)/);
  assert.match(preview, /authenticatedFetch\(`\/api\/business-preview/);
  assert.match(preview, /authenticatedFetch\("\/api\/business-preview"/);
  assert.match(preview, /authenticatedFetch\("\/api\/business-publications"/);
  assert.doesNotMatch(preview, /\/api\/business-build|OpenAI|n8n/i);
});

test("production navigation remains same-origin and does not introduce a competing auth host", async () => {
  const files = await Promise.all([
    source("app/login/page.tsx"),
    source("app/signup/page.tsx"),
    source("app/business-preview/page.tsx"),
  ]);
  assert.doesNotMatch(files.join("\n"), /https:\/\/(?:www\.)?buzypeezy\.ai/);
});
