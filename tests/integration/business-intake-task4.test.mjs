import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateBusinessDnaPatch, materializeBusinessDna, projectBusinessDnaToProjectMemory } from "../../app/lib/business-dna.ts";
import { mergeExplicitDnaWithInferences, unansweredSuggestedQuestions, validateBusinessIntakeAnalysis, BUSINESS_INTAKE_MAX_QUESTIONS } from "../../app/lib/business-intake-analysis.ts";
import { analyzeBusinessIntakeDeterministically, extractExplicitVisionDna, planAdaptiveQuestions } from "../../app/lib/business-intake-planner.ts";
import { buildBusinessReviewSections } from "../../app/lib/business-intake-review.ts";
import { BUSINESS_INTAKE_COMPLETION_MATRIX, BUSINESS_INTAKE_QUESTIONS, businessIntakeQuestionIntent, countSavedBusinessIntakeAnswers, eligibleBusinessIntakeQuestions, isBusinessIntakeQuestionSemanticallyEligible, selectCurrentBusinessIntakeQuestion } from "../../app/lib/business-intake-questions.ts";
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
test("8d stored 6–12 month goal skips a mis-tagged duplicate goal suggestion", () => {
  const analysis = { ...validAnalysis, suggestedQuestions: [
    { id: "duplicate-future-goal", dnaPath: "goals.primaryGoal", question: "What would you like the business to achieve in the next 6 to 12 months?", reason: "Goal context", required: true, answerType: "textarea" },
  ] };
  assert.deepEqual(unansweredSuggestedQuestions(analysis, { goals: { sixToTwelveMonthGoal: "Grow qualified enquiries over the next year" } }), []);
});
test("8e original-vision inferred goal skips the resumed duplicate", () => {
  const analysis = { ...validAnalysis, extractedDna: { goals: { sixToTwelveMonthGoal: "Build a professional presence in the next year" } }, suggestedQuestions: [
    { id: "duplicate-future-goal", dnaPath: "goals.primaryGoal", question: "Where should the business be in the next 12 months?", reason: "Goal context", required: true, answerType: "textarea" },
  ] };
  const currentDna = mergeExplicitDnaWithInferences({}, analysis.extractedDna);
  assert.deepEqual(unansweredSuggestedQuestions(analysis, currentDna), []);
});
test("8f absent time-horizon goal remains eligible and distinct from a populated main goal", () => {
  const analysis = { ...validAnalysis, suggestedQuestions: [
    { id: "future-goal", dnaPath: "goals.sixToTwelveMonthGoal", question: "Where should the business be in the next 12 months?", reason: "Goal context", required: true, answerType: "textarea" },
  ] };
  assert.deepEqual(unansweredSuggestedQuestions(analysis, { goals: { primaryGoal: "Attract serious business clients" } }).map((question) => question.id), ["future-goal"]);
});
test("8g populated main goal skips equivalent generic goal wording but not unrelated questions", () => {
  const analysis = { ...validAnalysis, suggestedQuestions: [
    { id: "duplicate-main-goal", dnaPath: "goals.sixToTwelveMonthGoal", question: "What is the main goal for your business?", reason: "Goal context", required: true, answerType: "textarea" },
    { id: "desired-customers", dnaPath: "customers.desiredCustomers", question: "Who do you want to reach?", reason: "Customer context", required: true, answerType: "textarea" },
  ] };
  assert.deepEqual(unansweredSuggestedQuestions(analysis, { goals: { primaryGoal: "Generate qualified enquiries" } }).map((question) => question.id), ["desired-customers"]);
});
test("8h persisted duplicate goal question is removed on resume and never rendered", () => {
  const questions = [
    { id: "duplicate-future-goal", path: "goals.sixToTwelveMonthGoal", question: "What should happen in the next year?", required: true, answerType: "textarea" },
  ];
  assert.equal(selectCurrentBusinessIntakeQuestion({ questions, dna: { goals: { sixToTwelveMonthGoal: "Generate qualified enquiries" } }, currentQuestionId: "duplicate-future-goal" }), null);
});
test("8i invalid persisted current question automatically advances to the next valid question", () => {
  const questions = [
    { id: "future-goal", path: "goals.sixToTwelveMonthGoal", question: "Future goal?", required: true, answerType: "textarea" },
    { id: "desired-customers", path: "customers.desiredCustomers", question: "Desired customers?", required: true, answerType: "textarea" },
  ];
  assert.equal(selectCurrentBusinessIntakeQuestion({ questions, dna: { goals: { sixToTwelveMonthGoal: "Already saved" } }, currentQuestionId: "future-goal" })?.id, "desired-customers");
});
test("8j no valid resumed questions advances directly to review without changing six saved answers", () => {
  const dna = { identity: { businessName: "Agency", businessStage: "established" }, customers: { desiredCustomers: "Serious clients" }, goals: { primaryGoal: "Professional presence", sixToTwelveMonthGoal: "Qualified enquiries", primaryLeadObjective: "More enquiries" } };
  const before = structuredClone(dna);
  const questions = [
    { id: "future-goal", path: "goals.sixToTwelveMonthGoal", question: "Future goal?", required: true, answerType: "textarea" },
    { id: "primary-goal", path: "goals.primaryGoal", question: "Main goal?", required: true, answerType: "textarea" },
    { id: "lead-objective", path: "goals.primaryLeadObjective", question: "Lead goal?", required: true, answerType: "choice-or-text" },
  ];
  assert.equal(countSavedBusinessIntakeAnswers(dna), 6);
  assert.equal(selectCurrentBusinessIntakeQuestion({ questions, dna, currentQuestionId: "future-goal" }), null);
  assert.deepEqual(dna, before);
});
test("8k resume/render selection contains no provider, Easy Mode or Task 5 execution", async () => {
  const source = await readFile("app/lib/business-intake-questions.ts", "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|requestBusinessIntakeAnalysis|executeEasyMode|easyModeRuns|Task 5/i);
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
test("25 idempotency claim occurs before provider execution or draft persistence", async () => {
  const source = await readFile("app/api/business-dna/analyze/route.ts", "utf8");
  assert.ok(source.indexOf("deps.claimUsage") < source.indexOf("deps.provider"));
  assert.ok(source.indexOf("deps.claimUsage") < source.lastIndexOf("persistAnalysisDraft"));
});
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
  const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "request-123" }) }), { verify: async () => ({ uid: "owner" }), read: async () => dna, update: async (input) => materializeBusinessDna({ content: input.patch, confirmed: input.confirmed, confirmedAt: null, revisionCount: 1, createdAt: new Date(0), updatedAt: new Date(1) }), provider: async () => { called = true; return { analysis: validAnalysis }; }, claimUsage: async () => { called = true; return { usageId: "", created: true, status: "started" }; }, completeUsage: async () => {}, failUsage: async () => {} });
  assert.equal(response.status, 200); assert.equal(called, false);
  if (old === undefined) delete process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; else process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = old;
});
test("32 refresh resumes from persisted DNA without another analysis request", async () => {
  const source = await readFile("app/onboarding/page.tsx", "utf8");
  const loadBlock = source.slice(source.indexOf("async function load()"), source.indexOf("async function saveDnaPatch"));
  assert.match(loadBlock, /analyzeBusinessIntakeDeterministically/);
  assert.doesNotMatch(loadBlock, /requestAnalysis\(id\)/);
});
test("33 existing Task 3 voice behavior remains intact", async () => {
  const source = await readFile("app/onboarding/page.tsx", "utf8"); assert.match(source, /useBrowserSpeech/); assert.match(source, /transcript stays editable/i); assert.doesNotMatch(source, /onTranscript:[\s\S]{0,200}saveAnswer/);
});
test("34 successful merged analysis draft is persisted unconfirmed with explicit answers winning", async () => {
  const oldEnabled = process.env.BUSINESS_INTAKE_PROVIDER_ENABLED;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test";
  const existing = materializeBusinessDna({ content: { identity: { businessName: "Explicit name" }, conversation: { originalVisionText: "Grow over the next year", preferredLanguage: "english" } }, confirmed: false, confirmedAt: null, revisionCount: 0, createdAt: new Date(0), updatedAt: new Date(0) });
  let savedInput;
  try {
    const response = await handleBusinessDnaAnalyze(new Request("http://local", { method: "POST", body: JSON.stringify({ projectId: "p1", requestId: "request-draft-1" }) }), {
      verify: async () => ({ uid: "owner" }), read: async () => existing,
      provider: async () => ({ analysis: { ...validAnalysis, extractedDna: { identity: { businessName: "Inferred name", industry: "Agency" }, goals: { sixToTwelveMonthGoal: "Grow qualified enquiries" } } } }),
      update: async (input) => { savedInput = input; return materializeBusinessDna({ content: input.patch, confirmed: input.confirmed, confirmedAt: null, revisionCount: 1, createdAt: new Date(0), updatedAt: new Date(1) }); },
      claimUsage: async () => ({ usageId: "usage", created: true, status: "started" }), completeUsage: async () => {}, failUsage: async () => {},
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(savedInput.confirmed, false);
    assert.equal(savedInput.patch.identity.businessName, "Explicit name");
    assert.equal(savedInput.patch.identity.industry, "Agency");
    assert.equal(body.dna.goals.sixToTwelveMonthGoal, "Grow qualified enquiries");
    assert.equal(body.dna.conversation.confirmed, false);
    const resumed = analyzeBusinessIntakeDeterministically({
      preferredLanguage: "english", originalVisionText: body.dna.conversation.originalVisionText,
      savedDna: { identity: body.dna.identity, goals: body.dna.goals, conversation: { originalVisionText: body.dna.conversation.originalVisionText, preferredLanguage: "english" } },
    });
    assert.ok(!resumed.suggestedQuestions.some((question) => question.dnaPath === "goals.sixToTwelveMonthGoal"));
  } finally {
    if (oldEnabled === undefined) delete process.env.BUSINESS_INTAKE_PROVIDER_ENABLED; else process.env.BUSINESS_INTAKE_PROVIDER_ENABLED = oldEnabled;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});
test("35 legacy project recovery extracts only an explicitly stated 6–12 month goal", () => {
  const vision = "I run an agency. I want to attract serious clients and generate qualified enquiries over the next 6 to 12 months.";
  assert.equal(extractExplicitVisionDna(vision).goals?.sixToTwelveMonthGoal, "I want to attract serious clients and generate qualified enquiries over the next 6 to 12 months.");
  assert.equal(extractExplicitVisionDna("I run an agency with a small team.").goals, undefined);
});
test("36 explicit run wording recovers canonical existing-business stage", () => {
  assert.equal(extractExplicitVisionDna("I run a digital marketing agency").identity?.businessStage, "established/existing");
});
test("37 operating duration recovers both stage and canonical business age", () => {
  const recovered = extractExplicitVisionDna("We have been operating for two years in Bangalore.");
  assert.equal(recovered.identity?.businessStage, "established/existing");
  assert.equal(recovered.founderHistory?.businessAge, "two years");
});
test("38 persisted stage overrides recovered stage", () => {
  const recovered = extractExplicitVisionDna("I run a digital marketing agency.");
  assert.equal(mergeExplicitDnaWithInferences({ identity: { businessStage: "startup/new" } }, recovered).identity?.businessStage, "startup/new");
});
test("39 starting and ambiguous wording do not become existing businesses", () => {
  assert.equal(extractExplicitVisionDna("I am starting a new digital agency.").identity?.businessStage, undefined);
  assert.equal(extractExplicitVisionDna("Digital marketing could be a useful opportunity.").identity?.businessStage, undefined);
});
test("40 recovered stage removes the stage question while unknown stage remains eligible", () => {
  const recovered = extractExplicitVisionDna("I run a digital marketing agency and have been operating for two years.");
  assert.ok(!eligibleBusinessIntakeQuestions(BUSINESS_INTAKE_QUESTIONS, recovered).some((question) => question.id === "business-stage"));
  assert.ok(eligibleBusinessIntakeQuestions(BUSINESS_INTAKE_QUESTIONS, {}).some((question) => question.id === "business-stage"));
});
test("41 legacy recovery preserves six saved answers and remains unconfirmed", () => {
  const saved = { identity: { businessName: "Agency" }, customers: { desiredCustomers: "Serious clients" }, digitalPresence: { existingWebsite: "no" }, goals: { primaryGoal: "Professional presence", sixToTwelveMonthGoal: "Qualified enquiries", primaryLeadObjective: "More enquiries" } };
  const before = structuredClone(saved);
  const recovered = mergeExplicitDnaWithInferences(saved, extractExplicitVisionDna("I run a digital marketing agency and have been operating for two years."));
  assert.equal(countSavedBusinessIntakeAnswers(saved), 6);
  assert.deepEqual(saved, before);
  assert.equal(recovered.identity?.businessStage, "established/existing");
  assert.equal(recovered.founderHistory?.businessAge, "two years");
  assert.equal("confirmed" in (recovered.conversation ?? {}), false);
});
test("42 canonical completion matrix covers every normalized intake concept", () => {
  assert.deepEqual(BUSINESS_INTAKE_COMPLETION_MATRIX.target_customer, ["customers.desiredCustomers", "customers.targetAudience"]);
  assert.deepEqual(BUSINESS_INTAKE_COMPLETION_MATRIX.products_services, ["offer.strongestOffers", "offer.products", "offer.services"]);
  assert.deepEqual(BUSINESS_INTAKE_COMPLETION_MATRIX.six_to_twelve_month_goal, ["goals.sixToTwelveMonthGoal"]);
  assert.equal(Object.keys(BUSINESS_INTAKE_COMPLETION_MATRIX).length, 23);
});
test("43 target-customer intent accepts desired customer or target audience aliases", () => {
  const question = { dnaPath: "customers.desiredCustomers", question: "Who is the customer you most want to reach?" };
  assert.equal(businessIntakeQuestionIntent(question), "target_customer");
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, { customers: { desiredCustomers: "Local MSMEs" } }), false);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, { customers: { targetAudience: "Bangalore small businesses" } }), false);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, {}), true);
});
test("44 mis-tagged provider customer question is skipped by semantic intent", () => {
  const analysis = { ...validAnalysis, suggestedQuestions: [
    { id: "customer-focus", dnaPath: "goals.primaryGoal", question: "Who is the customer you most want to reach?", reason: "Customer context", required: true, answerType: "textarea" },
  ] };
  assert.deepEqual(unansweredSuggestedQuestions(analysis, { customers: { targetAudience: "Established local MSMEs" } }), []);
});
test("45 services intent uses products, services or strongest offers as completion", () => {
  const question = { dnaPath: "offer.strongestOffers", question: "What products or services do you want to be known for?" };
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, { offer: { services: ["Website design"] } }), false);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, {}), true);
});
test("46 social and portfolio intents honor explicit negative and proof states", () => {
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible({ dnaPath: "digitalPresence.socialPresence", question: "Do you have any social profiles?" }, { digitalPresence: { socialPresence: ["no_profiles"] } }), false);
  const proofQuestion = { dnaPath: "offer.differentiators", question: "Do you have case studies or testimonials to share?" };
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(proofQuestion, { personality: { trustSignals: ["have_portfolio"] } }), false);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(proofQuestion, { digitalPresence: { existingWebsite: "have_portfolio" } }), false);
});
test("47 website problems remain globally inapplicable without an existing website", () => {
  const question = { dnaPath: "digitalPresence.websiteStatus", question: "What traffic or conversion problems does your current website have?" };
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, { digitalPresence: { existingWebsite: "no" } }), false);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible(question, { digitalPresence: { existingWebsite: "https://example.com" } }), true);
  assert.equal(isBusinessIntakeQuestionSemanticallyEligible({ dnaPath: "digitalPresence.websiteStatus", question: "What should your future website include?" }, { digitalPresence: { existingWebsite: "no" } }), true);
});
test("48 review formats stage enums and preserves correct online categories", () => {
  const items = buildBusinessReviewSections({ identity: { businessStage: "established/existing" }, digitalPresence: { existingWebsite: "have_portfolio", socialPresence: ["no_profiles"] } }).flatMap((section) => section.items);
  assert.equal(items.find((item) => item.label === "Stage")?.value, "Existing / operating business");
  assert.ok(items.every((item) => !/established\/existing|have_portfolio|no_profiles/.test(item.value)));
});
