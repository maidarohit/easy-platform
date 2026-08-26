import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  handleBusinessDnaGet,
  handleBusinessDnaPatch,
} from "../../app/api/business-dna/route.ts";
import {
  answerToBusinessDnaPatch,
  BUSINESS_INTAKE_QUESTIONS,
  getApplicableQuestions,
  getNextBusinessIntakeQuestion,
  isQuestionComplete,
} from "../../app/lib/business-intake-questions.ts";
import {
  mergeBusinessDnaContent,
  validateBusinessDnaPatch,
} from "../../app/lib/business-dna.ts";

const question = (id) => BUSINESS_INTAKE_QUESTIONS.find((item) => item.id === id);
const complete = (dna, id, answer) => mergeBusinessDnaContent(dna, answerToBusinessDnaPatch(question(id), answer));

function mockDependencies() {
  const owners = new Map([["one", "user-a"], ["two", "user-b"], ["legacy", "user-a"]]);
  const rows = new Map();
  const verify = async (request) => {
    const uid = request.headers.get("x-user");
    if (!uid) throw new Error("unauthenticated");
    return { uid };
  };
  const materialize = (content) => ({
    ...content,
    conversation: { ...(content.conversation ?? {}), confirmed: false, confirmedAt: null, revisionCount: 0 },
    metadata: { schemaVersion: 1, createdAt: "2026-08-26T00:00:00.000Z", updatedAt: "2026-08-26T00:00:00.000Z" },
  });
  return {
    rows,
    deps: {
      verify,
      read: async (uid, projectId) => owners.get(projectId) === uid ? (rows.get(projectId) ?? null) : undefined,
      update: async ({ userId, projectId, patch }) => {
        if (owners.get(projectId) !== userId) return undefined;
        const current = rows.get(projectId) ?? null;
        const content = mergeBusinessDnaContent(current, patch);
        const value = materialize(content);
        rows.set(projectId, value);
        return value;
      },
    },
  };
}

const get = (projectId, uid = "user-a") => new Request(`https://example.invalid/api/business-dna?projectId=${projectId}`, { headers: uid ? { "x-user": uid } : {} });
const patch = (body, uid = "user-a") => new Request("https://example.invalid/api/business-dna", {
  method: "PATCH", headers: { "content-type": "application/json", ...(uid ? { "x-user": uid } : {}) }, body: JSON.stringify(body),
});

test("1. initial vision saves exactly", () => {
  const vision = "  I build precision pumps.\nPlease help me grow.  ";
  assert.equal(validateBusinessDnaPatch({ conversation: { originalVisionText: vision } }).conversation.originalVisionText, vision);
});

test("2. Unicode Hindi text survives round-trip", () => {
  const value = "मैं जयपुर में हस्तनिर्मित कपड़े बेचता हूँ।";
  const saved = mergeBusinessDnaContent(null, validateBusinessDnaPatch({ conversation: { originalVisionText: value } }));
  assert.equal(saved.conversation.originalVisionText, value);
});

test("3. Hinglish text survives round-trip", () => {
  const value = "Hum local दुकानदारों ko online grow karna chahte hain.";
  assert.equal(validateBusinessDnaPatch({ conversation: { originalVisionText: value } }).conversation.originalVisionText, value);
});

test("4. the engine returns one question at a time", () => {
  const next = getNextBusinessIntakeQuestion({ conversation: { originalVisionText: "A business" } });
  assert.equal(next.id, "business-name");
  assert.equal(Array.isArray(next), false);
});

test("5. answers map to the declared Business DNA path", () => {
  assert.deepEqual(answerToBusinessDnaPatch(question("service-areas"), "Bengaluru, Mysuru"), { location: { serviceAreas: ["Bengaluru", "Mysuru"] } });
  assert.deepEqual(answerToBusinessDnaPatch(question("primary-goal"), "More sales"), { goals: { primaryGoal: "More sales" } });
});

test("6. an optional question can be skipped", () => {
  const dna = answerToBusinessDnaPatch(question("why-started"), "");
  assert.equal(isQuestionComplete(question("why-started"), dna), true);
});

test("7. a required question cannot disappear with an empty answer", () => {
  const dna = answerToBusinessDnaPatch(question("business-name"), "");
  assert.equal(isQuestionComplete(question("business-name"), dna), false);
  assert.equal(getNextBusinessIntakeQuestion(dna).id, "business-name");
});

test("8. answered questions are not repeated", () => {
  const dna = complete({}, "business-name", "Acme");
  assert.equal(getNextBusinessIntakeQuestion(dna).id, "business-stage");
});

test("9. an existing website enables the website-problem question", () => {
  const dna = { digitalPresence: { existingWebsite: "https://acme.example" } };
  assert.ok(getApplicableQuestions(dna).some((item) => item.id === "website-problem"));
});

test("10. no website skips the website-performance question", () => {
  const dna = { digitalPresence: { existingWebsite: "no" } };
  assert.equal(getApplicableQuestions(dna).some((item) => item.id === "website-problem"), false);
});

test("11. startup ordering differs from established-business ordering", () => {
  const startup = getApplicableQuestions({ identity: { businessStage: "startup/new" } }).map((item) => item.id);
  const established = getApplicableQuestions({ identity: { businessStage: "established/existing" } }).map((item) => item.id);
  assert.notDeepEqual(startup, established);
  assert.ok(startup.indexOf("desired-customers") < startup.indexOf("location"));
  assert.ok(established.includes("business-age"));
  assert.equal(startup.includes("business-age"), false);
});

test("12. refresh/resume selects the next unanswered saved question", () => {
  let saved = { conversation: { originalVisionText: "Grow my workshop" } };
  saved = complete(saved, "business-name", "Acme Workshop");
  saved = complete(saved, "business-stage", "startup/new");
  assert.equal(getNextBusinessIntakeQuestion(structuredClone(saved)).id, "desired-customers");
});

test("13. two projects cannot leak intake state", async () => {
  const mock = mockDependencies();
  await handleBusinessDnaPatch(patch({ projectId: "one", dna: { identity: { businessName: "One" } } }), mock.deps);
  await handleBusinessDnaPatch(patch({ projectId: "two", dna: { identity: { businessName: "Two" } } }, "user-b"), mock.deps);
  assert.equal((await (await handleBusinessDnaGet(get("one"), mock.deps)).json()).dna.identity.businessName, "One");
  assert.equal((await (await handleBusinessDnaGet(get("two", "user-b"), mock.deps)).json()).dna.identity.businessName, "Two");
});

test("14. unauthorized project access is rejected", async () => {
  const mock = mockDependencies();
  assert.equal((await handleBusinessDnaGet(get("two", "user-a"), mock.deps)).status, 404);
  assert.equal((await handleBusinessDnaGet(get("one", ""), mock.deps)).status, 401);
});

test("15. client userId cannot override ownership", async () => {
  const mock = mockDependencies();
  const response = await handleBusinessDnaPatch(patch({ projectId: "two", userId: "user-b", dna: {} }, "user-a"), mock.deps);
  assert.equal(response.status, 400);
});

test("16. an existing project without DNA loads safely", async () => {
  const mock = mockDependencies();
  const response = await handleBusinessDnaGet(get("legacy"), mock.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, dna: null });
});

test("17. intake persistence does not clear existing Project Memory", async () => {
  const store = await readFile(new URL("../../app/lib/business-dna-store.ts", import.meta.url), "utf8");
  assert.match(store, /if \(Object\.keys\(projection\)\.length > 0\)/);
  assert.doesNotMatch(store, /delete\(projectMemory\)|businessName:\s*null|additionalContext:\s*null/);
});

test("18. Task 4 confirms Business DNA only after explicit review action", async () => {
  const page = await readFile(new URL("../../app/onboarding/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Yes, this looks right/);
  assert.match(page, /confirmUnderstanding/);
  assert.match(page, /Here&apos;s what I understood about your business/);
});

test("19. confirmed onboarding exposes only the Task 5 business-build entrypoint", async () => {
  const page = await readFile(new URL("../../app/onboarding/page.tsx", import.meta.url), "utf8");
  assert.match(page, /authenticatedFetch\("\/api\/business-build"/);
  assert.match(page, /"Build My Business"/);
  assert.doesNotMatch(page, /api\/easy-mode|\/easy-mode\?|executeRun/);
});

test("20. intake contains no provider or network AI call", async () => {
  const [page, engine] = await Promise.all([
    readFile(new URL("../../app/onboarding/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/lib/business-intake-questions.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(`${page}\n${engine}`, /OPENAI|GEMINI|N8N_|startAiUsage|ai-manager|\/api\/(?:assistant|.*-ai)/i);
  assert.match(page, /authenticatedFetch\("\/api\/business-dna"/);
});
