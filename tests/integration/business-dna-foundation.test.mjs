import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  handleBusinessDnaGet,
  handleBusinessDnaPatch,
} from "../../app/api/business-dna/route.ts";
import {
  materializeBusinessDna,
  mergeBusinessDnaContent,
  projectBusinessDnaToProjectMemory,
  validateBusinessDnaPatch,
} from "../../app/lib/business-dna.ts";

function createMockDependencies() {
  const projects = new Map([
    ["project-a", "owner-a"],
    ["project-b", "owner-a"],
    ["project-c", "owner-b"],
    ["legacy-project", "owner-a"],
  ]);
  const rows = new Map();
  const providerCalls = [];
  const verify = async (request) => {
    const uid = request.headers.get("x-test-user");
    if (!uid) throw new Error("unauthenticated");
    return { uid };
  };
  return {
    projects,
    rows,
    providerCalls,
    deps: {
      verify,
      read: async (userId, projectId) => {
        if (projects.get(projectId) !== userId) return undefined;
        return rows.get(projectId)?.value ?? null;
      },
      update: async ({ userId, projectId, patch, confirmed }) => {
        if (projects.get(projectId) !== userId) return undefined;
        const existing = rows.get(projectId);
        const now = new Date(existing ? "2026-08-26T12:00:00.000Z" : "2026-08-26T10:00:00.000Z");
        const content = mergeBusinessDnaContent(existing?.content ?? null, patch);
        const isConfirmed = confirmed ?? existing?.confirmed ?? false;
        const confirmedAt = confirmed === true
          ? (existing?.confirmedAt ?? now)
          : confirmed === false ? null : (existing?.confirmedAt ?? null);
        const value = materializeBusinessDna({
          content,
          confirmed: isConfirmed,
          confirmedAt,
          revisionCount: existing ? existing.revisionCount + 1 : 0,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
        rows.set(projectId, {
          content, confirmed: isConfirmed, confirmedAt,
          revisionCount: existing ? existing.revisionCount + 1 : 0,
          createdAt: existing?.createdAt ?? now, value,
        });
        return value;
      },
    },
  };
}

const getRequest = (projectId, userId = "owner-a") => new Request(
  `https://example.invalid/api/business-dna?projectId=${projectId}`,
  { headers: userId ? { "x-test-user": userId } : {} },
);
const patchRequest = (body, userId = "owner-a") => new Request(
  "https://example.invalid/api/business-dna",
  {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(userId ? { "x-test-user": userId } : {}) },
    body: JSON.stringify(body),
  },
);

test("existing projects without Business DNA remain readable", async () => {
  const mock = createMockDependencies();
  const response = await handleBusinessDnaGet(getRequest("legacy-project"), mock.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, dna: null });
});

test("draft Business DNA can be created, partially updated, and resumed", async () => {
  const mock = createMockDependencies();
  const created = await handleBusinessDnaPatch(patchRequest({
    projectId: "project-a",
    dna: {
      identity: { businessName: "Acme Works", industry: "Manufacturing" },
      conversation: { preferredLanguage: "hinglish", originalVisionText: "Hum export badhana chahte hain." },
    },
  }), mock.deps);
  assert.equal(created.status, 200);
  const createdDna = (await created.json()).dna;
  assert.equal(createdDna.conversation.confirmed, false);
  assert.equal(createdDna.metadata.schemaVersion, 1);

  const updated = await handleBusinessDnaPatch(patchRequest({
    projectId: "project-a",
    dna: { offer: { products: ["Precision parts"], differentiators: ["30 years experience"] } },
  }), mock.deps);
  assert.equal(updated.status, 200);
  const resumed = await handleBusinessDnaGet(getRequest("project-a"), mock.deps);
  const resumedDna = (await resumed.json()).dna;
  assert.equal(resumedDna.identity.businessName, "Acme Works");
  assert.deepEqual(resumedDna.offer.products, ["Precision parts"]);
  assert.equal(resumedDna.conversation.revisionCount, 1);
});

test("confirmation is server metadata and draft can be reopened", async () => {
  const mock = createMockDependencies();
  const confirmed = await handleBusinessDnaPatch(patchRequest({
    projectId: "project-a", dna: { goals: { primaryGoal: "Grow exports" } }, confirmed: true,
  }), mock.deps);
  const confirmedDna = (await confirmed.json()).dna;
  assert.equal(confirmedDna.conversation.confirmed, true);
  assert.equal(confirmedDna.conversation.confirmedAt, "2026-08-26T10:00:00.000Z");
  assert.equal(validateBusinessDnaPatch({ conversation: { confirmed: true } }), null);

  const reopened = await handleBusinessDnaPatch(patchRequest({ projectId: "project-a", dna: {}, confirmed: false }), mock.deps);
  const reopenedDna = (await reopened.json()).dna;
  assert.equal(reopenedDna.conversation.confirmed, false);
  assert.equal(reopenedDna.conversation.confirmedAt, null);
});

test("authentication and project ownership are enforced without client userId", async () => {
  const mock = createMockDependencies();
  assert.equal((await handleBusinessDnaGet(getRequest("project-a", ""), mock.deps)).status, 401);
  assert.equal((await handleBusinessDnaGet(getRequest("project-c", "owner-a"), mock.deps)).status, 404);
  assert.equal((await handleBusinessDnaPatch(patchRequest({ projectId: "project-c", dna: {} }, "owner-a"), mock.deps)).status, 404);
  assert.equal((await handleBusinessDnaPatch(patchRequest({ projectId: "project-a", userId: "owner-b", dna: {} }), mock.deps)).status, 400);
});

test("two projects retain independent Business DNA", async () => {
  const mock = createMockDependencies();
  await handleBusinessDnaPatch(patchRequest({ projectId: "project-a", dna: { identity: { businessName: "Alpha" } } }), mock.deps);
  await handleBusinessDnaPatch(patchRequest({ projectId: "project-b", dna: { identity: { businessName: "Beta" } } }), mock.deps);
  assert.equal(((await (await handleBusinessDnaGet(getRequest("project-a"), mock.deps)).json()).dna).identity.businessName, "Alpha");
  assert.equal(((await (await handleBusinessDnaGet(getRequest("project-b"), mock.deps)).json()).dna).identity.businessName, "Beta");
});

test("compatibility projection is deterministic and preserves specialist field names", () => {
  const dna = validateBusinessDnaPatch({
    identity: { businessName: "Acme Works", industry: "Manufacturing", subIndustry: "Auto parts" },
    founderHistory: { founderStory: "Started by two engineers." },
    offer: { products: ["Precision gears"], differentiators: ["Same-day quality reports"] },
    customers: { targetAudience: "Automotive purchasing teams" },
    personality: { brandPersonality: ["Reliable", "Precise"], tone: "Confident" },
    goals: { primaryGoal: "Grow exports", primaryLeadObjective: "Qualified RFQs" },
  });
  assert.ok(dna);
  const first = projectBusinessDnaToProjectMemory(dna);
  const second = projectBusinessDnaToProjectMemory(dna);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    businessName: "Acme Works",
    industry: "Manufacturing",
    businessDescription: "Started by two engineers.\nProducts: Precision gears\nDifferentiators: Same-day quality reports",
    targetAudience: "Automotive purchasing teams",
    brandStyle: "Reliable, Precise",
    brandVoice: "Confident",
    websiteGoal: "Qualified RFQs",
    marketingGoal: "Grow exports",
    additionalContext: "Auto parts",
  });
});

test("schema migration is additive, one-to-one, and provider-free", async () => {
  const [schema, migration, route, store] = await Promise.all([
    readFile(new URL("../../app/db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../../drizzle/0016_add-project-business-dna.sql", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/business-dna/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/lib/business-dna-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /projectBusinessDna = pgTable/);
  assert.match(migration, /CREATE TABLE "project_business_dna"/);
  assert.match(migration, /"project_id" text PRIMARY KEY NOT NULL/);
  assert.match(migration, /ON DELETE cascade/);
  assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE FROM|ALTER TABLE "project_memory"/i);
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(store, /eq\(projects\.userId, input\.userId\)/);
  assert.match(store, /projectBusinessDna/);
  assert.match(store, /projectMemory/);
  assert.doesNotMatch(`${route}\n${store}`, /startAiUsage|N8N_|OPENAI|GEMINI|fetch\s*\(/i);
});
