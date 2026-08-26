import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateBusinessDnaPatch, materializeBusinessDna, projectBusinessDnaToProjectMemory } from "../../app/lib/business-dna.ts";
import { mergeExplicitDnaWithInferences, unansweredSuggestedQuestions, validateBusinessIntakeAnalysis, BUSINESS_INTAKE_MAX_QUESTIONS } from "../../app/lib/business-intake-analysis.ts";
import { analyzeBusinessIntakeDeterministically, planAdaptiveQuestions } from "../../app/lib/business-intake-planner.ts";
import { buildBusinessReviewSections } from "../../app/lib/business-intake-review.ts";
import { countSavedBusinessIntakeAnswers } from "../../app/lib/business-intake-questions.ts";
import { handleBusinessDnaAnalyze } from "../../app/api/business-dna/analyze/route.ts";
import { handleBusinessDnaPatch } from "../../app/api/business-dna/route.ts";

const baseInput = (overrides = {}) => ({ preferredLanguage: "english", originalVisionText: "I run a digital marketing agency in Bangalore", savedDna: { identity: { businessStage: "established business" } }, ...overrides });
const validAnalysis = { extractedDna: {}, confidence: {}, missingAreas: [], suggestedQuestions: [], understandingSummary: "Understood.", buildPlanSummary: ["A focused plan"] };

test("1 original vision analyzed into supported DNA fields", () => {
  assert.equal(analyzeBusinessIntakeDeterministically(baseInput()).extractedDna.location?.city, "Bangalore");
});
test("2 explicit saved answer beats conflicting AI inference", () => {
  assert.equal(mergeExplicitDnaWithInferences({ location: { city: "Bangalore" } }, { location: { city: "Mumbai" } }).location?.city, "Bangalore");
});
test("3 unsupported AI field rejected", () => assert.equal(validateBusinessDnaPatch({ identity: { revenue: "10 crore" } }), null));
test("4 hallucinated unsupported data not merged", () => assert.equal(validateBusinessIntakeAnalysis({ ...validAnalysis, extractedDna: { founderHistory: { customerCount: "500" } } }), null));
test("5 already-answered city is not asked again", () => assert.ok(!planAdaptiveQuestions({ location: { city: "Bangalore" } }, "english").some((q) => q.dnaPath === "location.city")));
test("6 already-answered business age is not asked again", () => assert.ok(!planAdaptiveQuestions({ identity: { businessStage: "established" }, founderHistory: { businessAge: "two years" } }, "english").some((q) => q.dnaPath === "founderHistory.businessAge")));
test("7 no-website user skips website-performance question", () => assert.ok(!planAdaptiveQuestions({ digitalPresence: { existingWebsite: "no" } }, "english").some((q) => q.dnaPath === "digitalPresence.websiteStatus")));
test("7a no-proper-website state skips current website problem question", () => assert.ok(!planAdaptiveQuestions({ digitalPresence: { websiteStatus: "Does not currently have a proper website" } }, "english").some((q) => q.dnaPath === "digitalPresence.websiteStatus")));
test("8 existing website user can receive relevant website-problem question", () => assert.ok(planAdaptiveQuestions({ digitalPresence: { existingWebsite: "https://example.com" } }, "english").some((q) => q.dnaPath === "digitalPresence.websiteStatus")));
test("8a explicit no-website answer overrides a conflicting inference", () => {
  const merged = mergeExplicitDnaWithInferences({ digitalPresence: { existingWebsite: "no" } }, { digitalPresence: { existingWebsite: "https://inferred.example" } });
  assert.equal(merged.digitalPresence?.existingWebsite, "no");
  assert.ok(!planAdaptiveQuestions(merged, "english").some((question) => question.dnaPath === "digitalPresence.websiteStatus"));
});
test("8b website filtering leaves unrelated adaptive questions unchanged", () => {
  for (const existingWebsite of ["no", "yes"]) {
    const paths = planAdaptiveQuestions({ digitalPresence: { existingWebsite } }, "english").map((question) => question.dnaPath);
    assert.ok(paths.includes("customers.desiredCustomers"));
    assert.ok(paths.includes("offer.strongestOffers"));
    assert.ok(paths.includes("goals.sixToTwelveMonthGoal"));
  }
});
test("8c saved provider question sequence resumes without an invalid website question or new analysis", () => {
  const analysis = { ...validAnalysis, suggestedQuestions: [
    { id: "website-problem", dnaPath: "digitalPresence.websiteStatus", question: "What is not working well with your current website?", reason: "Website context", required: false, answerType: "textarea" },
    { id: "desired-customers", dnaPath: "customers.desiredCustomers", question: "Who do you want to reach?", reason: "Customer context", required: true, answerType: "textarea" },
  ] };
  assert.deepEqual(unansweredSuggestedQuestions(analysis, { digitalPresence: { existingWebsite: "have_portfolio" } }).map((question) => question.id), ["desired-customers"]);
});
test("9 startup and established MSME follow-ups differ", () => {
  const startup = planAdaptiveQuestions({ identity: { businessStage: "startup" } }, "english").map((q) => q.id);
  const msme = planAdaptiveQuestions({ identity: { businessStage: "established MSME" } }, "english").map((q) => q.id);
  assert.notDeepEqual(startup, msme);
});
test("10 question count remains within configured safe maximum", () => assert.ok(planAdaptiveQuestions({}, "english").length <= BUSINESS_INTAKE_MAX_QUESTIONS));
test("11 English questions are simple", () => assert.ok(planAdaptiveQuestions({}, "english").every((q) => q.question.length < 140)));
test("12 Hindi question output preserves Unicode", () => assert.match(planAdaptiveQuestions({}, "hindi")[0].question, /[\u0900-\u097F]/));
test("13 Hinglish output preserves mixed-language text", () => assert.match(planAdaptiveQuestions({}, "hinglish")[0].question, /Aap|customers/));
test("14 originalVisionText remains unchanged", () => {
  const vision = "  मेरे अपने exact words — unchanged  ";
  analyzeBusinessIntakeDeterministically(baseInput({ originalVisionText: vision }));
  assert.equal(vision, "  मेरे अपने exact words — unchanged  ");
});
test("15 review screen omits empty fields", () => assert.equal(buildBusinessReviewSections({ identity: { businessName: "Acme" } }).flatMap((s) => s.items).length, 1));
test("16 review screen contains customer-friendly labels", () => assert.deepEqual(buildBusinessReviewSections({ identity: { businessName: "Acme" } })[0].label, "Your business"));
test("16a review screen presents portfolio, website and social enums as customer copy", () => {
  const sections = buildBusinessReviewSections({ digitalPresence: { existingWebsite: "have_portfolio", socialPresence: ["no_profiles"] } });
  const items = sections.flatMap((section) => section.items);
  assert.deepEqual(items.find((item) => item.label === "Portfolio / proof"), {
    path: "personality.trustSignals", label: "Portfolio / proof", value: "Has case studies or testimonials to share",
  });
  assert.equal(items.find((item) => item.label === "Website")?.value, "Does not currently have a proper agency website");
  assert.equal(items.find((item) => item.label === "Social channels")?.value, "No social profiles yet");
  assert.ok(items.every((item) => !/have_portfolio|no_profiles/.test(item.value)));
});
test("16b answer counter derives from persisted DNA instead of remaining adaptive questions", () => {
  assert.equal(countSavedBusinessIntakeAnswers({ identity: { businessName: "Acme", businessStage: "startup/new" }, digitalPresence: { existingWebsite: "no" } }), 3);
});
test("17 correction updates Business DNA", async () => {
  const response = await handleBusinessDnaPatch(new Request("http://local/api/business-dna", { method: "PATCH", body: JSON.stringify({ projectId: "p1", dna: { location: { city: "Pune" } }, confirmed: false }) }), {
    verify: async () => ({ uid: "owner" }), read: async () => null, update: async (input) => materializeBusinessDna({ content: input.patch, confirmed: false, confirmedAt: null, revisionCount: 2, createdAt: new Date(0), updatedAt: new Date(0) }),
  });
  assert.equal((await response.json()).dna.location.city, "Pune");
});
test("18 correction invalidates stale confirmation where required", async () => {
  const source = await readFile("app/lib/business-dna-store.ts", "utf8");
  assert.match(source, /materiallyChanged[\s\S]*confirmed = input\.confirmed \?\?/);
  assert.match(source, /materiallyChanged \? false/);
});
test("19 explicit confirmation sets confirmed true", async () => {
  const response = await handleBusinessDnaPatch(new Request("http://local/api/business-dna", { method: "PATCH", body: JSON.stringify({ projectId: "p1", dna: {}, confirmed: true }) }), { verify: async () => ({ uid: "owner" }), read: async () => null, update: async (input) => materializeBusinessDna({ content: {}, confirmed: input.confirmed, confirmedAt: new Date(0), revisionCount: 1, createdAt: new Date(0), updatedAt: new Date(0) }) });
  assert.equal((await response.json()).dna.conversation.confirmed, true);
});
test("20 confirmedAt stored", () => assert.equal(materializeBusinessDna({ content: {}, confirmed: true, confirmedAt: new Date(0), revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) }).conversation?.confirmedAt, new Date(0).toISOString()));
test("21 no confirmation before customer action", () => assert.equal(materializeBusinessDna({ content: {}, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) }).conversation?.confirmed, false));
test("22 no Easy Mode run starts", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /executeEasyMode|easyModeRuns|\/easy-mode\/runs/));
test("23 no specialist workflow starts", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /executeValidatedJsonWebhook|n8n|branding-execution|text-specialist/i));
test("24 provider failure preserves saved intake", async () => {
  const old = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true"; process.env.OPENAI_API_KEY = "test";
  const dna = materializeBusinessDna({ content: { conversation: { originalVisionText: "Saved", preferredLanguage: "english" } }, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) });
  const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "request-123" }) }), { verify: async () => ({ uid: "owner" }), read: async () => dna, provider: async () => { throw new Error("fail"); }, claimUsage: async () => ({ usageId: "usage", created: true, status: "started" }), completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 502); assert.equal(dna.conversation.originalVisionText, "Saved");
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = old; delete process.env.OPENAI_API_KEY;
});
test("25 retry does not duplicate persisted analysis", async () => assert.doesNotMatch(await readFile("app/api/business-dna/analyze/route.ts", "utf8"), /insert\(|updateBusinessDna/));
test("26 unauthorized project rejected", async () => {
  const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "other", requestId: "request-123" }) }), { verify: async () => ({ uid: "owner" }), read: async () => undefined, provider: async () => { throw new Error(); }, claimUsage: async () => ({ usageId: "", created: true, status: "started" }), completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 404);
});
test("27 client userId cannot override ownership", async () => {
  const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "request-123", userId: "attacker" }) }), { verify: async () => ({ uid: "owner" }), read: async () => undefined, provider: async () => { throw new Error(); }, claimUsage: async () => ({ usageId: "", created: true, status: "started" }), completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 400);
});
test("28 two projects cannot leak analysis DNA", async () => {
  let readArgs; const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "project-a", requestId: "request-123" }) }), { verify: async () => ({ uid: "owner-a" }), read: async (...args) => { readArgs = args; return undefined; }, provider: async () => { throw new Error(); }, claimUsage: async () => ({ usageId: "", created: true, status: "started" }), completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 404); assert.deepEqual(readArgs, ["owner-a", "project-a"]);
});
test("29 two similar businesses produce materially different DNA projections", () => {
  const a = projectBusinessDnaToProjectMemory({ identity: { businessName: "North Studio", industry: "agency" }, location: { city: "Bangalore" }, founderHistory: { founderStory: "Started by a designer" }, offer: { differentiators: ["local expertise"] }, customers: { targetAudience: "startups" }, goals: { primaryGoal: "regional leads" } });
  const b = projectBusinessDnaToProjectMemory({ identity: { businessName: "Legacy Studio", industry: "agency" }, location: { city: "Jaipur" }, founderHistory: { founderStory: "Second-generation family firm" }, offer: { differentiators: ["40-year heritage"] }, customers: { targetAudience: "manufacturers" }, goals: { primaryGoal: "export enquiries" } });
  assert.notDeepEqual(a, b); assert.notEqual(a.additionalContext, b.additionalContext); assert.notEqual(a.targetAudience, b.targetAudience);
});
test("30 deterministic fallback still works without AI", () => assert.ok(analyzeBusinessIntakeDeterministically(baseInput()).suggestedQuestions.length > 0));
test("31 mocked analysis does not create real usage or provider call", async () => {
  const old = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; delete process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; let called = false;
  const dna = materializeBusinessDna({ content: { conversation: { originalVisionText: "A bakery in Pune", preferredLanguage: "english" } }, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) });
  const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "request-123" }) }), { verify: async () => ({ uid: "owner" }), read: async () => dna, provider: async () => { called = true; return { analysis: validAnalysis }; }, claimUsage: async () => { called = true; return { usageId: "", created: true, status: "started" }; }, completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 200); assert.equal(called, false); process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = old;
});
test("32 existing Task 2 resume behavior remains intact", async () => assert.match(await readFile("app/onboarding/page.tsx", "utf8"), /business-dna\?projectId=.*requestAnalysis/si));
test("33 existing Task 3 voice behavior remains intact", async () => {
  const source = await readFile("app/onboarding/page.tsx", "utf8"); assert.match(source, /useBrowserSpeech/); assert.match(source, /transcript stays editable/i); assert.doesNotMatch(source, /onTranscript:[\s\S]{0,200}saveAnswer/);
});
