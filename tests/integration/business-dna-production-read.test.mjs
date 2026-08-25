import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleBusinessDnaGet, safeDatabaseErrorDetails } from "../../app/api/business-dna/route.ts";
import { handleBusinessDnaMigration } from "../../app/api/internal/boss/business-dna-migration/route.ts";

const request = (projectId = "project-1", user = "owner") => new Request(`https://example.invalid/api/business-dna?projectId=${projectId}`, { headers: user ? { authorization: user } : {} });
const deps = (read) => ({ verify: async (req) => {
  const uid = req.headers.get("authorization");
  if (!uid) throw new Error("unauthenticated");
  return { uid };
}, read, update: async () => undefined });

test("1. existing project with no DNA row returns 200", async () => {
  const response = await handleBusinessDnaGet(request(), deps(async () => null));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, dna: null });
});

test("2. existing project with DNA row returns 200", async () => {
  const dna = { identity: { businessName: "Acme" }, metadata: { schemaVersion: 1 } };
  const response = await handleBusinessDnaGet(request(), deps(async () => dna));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).dna, dna);
});

test("3. nonexistent project is safely rejected", async () => {
  assert.equal((await handleBusinessDnaGet(request("missing"), deps(async () => undefined))).status, 404);
});

test("4. another user's project is rejected by the owner-scoped store result", async () => {
  assert.equal((await handleBusinessDnaGet(request("other", "owner"), deps(async () => undefined))).status, 404);
});

test("5. database failure is controlled and diagnostics redact secrets", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const response = await handleBusinessDnaGet(request(), deps(async () => { const error = new Error("relation missing postgresql://user:password@host/db password=hunter2"); error.code = "42P01"; throw error; }));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Failed to load Business DNA." });
    const details = safeDatabaseErrorDetails(Object.assign(new Error("postgresql://user:password@host/db password=hunter2"), { code: "42P01" }));
    assert.equal(details.code, "42P01");
    assert.doesNotMatch(details.message, /password|hunter2|user:/i);
  } finally {
    console.error = original;
  }
});

test("6. Project Memory remains unaffected by the additive migration", async () => {
  const migration = await readFile(new URL("../../drizzle/0016_add-project-business-dna.sql", import.meta.url), "utf8");
  assert.doesNotMatch(migration, /ALTER TABLE "project_memory"|DELETE FROM|DROP|TRUNCATE/i);
});

test("7. read and migration paths contain no provider calls", async () => {
  const sources = await Promise.all([
    readFile(new URL("../../app/api/business-dna/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/internal/boss/business-dna-migration/route.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /OPENAI|GEMINI|N8N_|startAiUsage|fetch\s*\(/i);
});

test("8. no Easy Mode run can start and migration requires boss auth", async () => {
  const route = await readFile(new URL("../../app/api/internal/boss/business-dna-migration/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /easyModeRuns|executeEasyMode|\/api\/easy-mode/i);
  let calls = 0;
  const migrate = async () => { calls += 1; return { state: "applied" }; };
  const denied = await handleBusinessDnaMigration(new Request("https://example.invalid", { method: "POST" }), migrate, { verify: async () => { throw new Error("no"); }, isBoss: async () => false });
  assert.equal(denied.status, 404);
  assert.equal(calls, 0);
  const allowed = await handleBusinessDnaMigration(new Request("https://example.invalid", { method: "POST" }), migrate, { verify: async () => ({ uid: "boss" }), isBoss: async () => true });
  assert.equal(allowed.status, 200);
  assert.equal(calls, 1);
});
