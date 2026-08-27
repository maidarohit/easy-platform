import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BUSINESS_BUILD_DELIVERABLES,
  buildBusinessReviewSections,
  synthesizeBusinessReviewRecommendations,
} from "../../app/lib/business-intake-review.ts";

const artistDna = (overrides = {}) => ({
  identity: { businessName: "My Art Studio", industry: "painting artist" },
  location: { city: "Bangalore" },
  offer: { strongestOffers: ["I offer portraits, canvas art and wall murals but I am not sure which sell best"] },
  customers: { desiredCustomers: "I don't know my customers yet — please recommend them" },
  conversation: { originalVisionText: "I am a painting artist offering custom portraits, canvas artwork and wall murals." },
  ...overrides,
});

test("1 unknown customers become useful, evidence-based recommendations", () => {
  const result = synthesizeBusinessReviewRecommendations(artistDna());
  assert.match(result.customers.desiredCustomers, /custom portraits/i);
  assert.match(result.customers.desiredCustomers, /interior designers/i);
  assert.match(result.customers.desiredCustomers, /Bangalore/);
  assert.doesNotMatch(result.customers.desiredCustomers, /don't know|not sure/i);
});

test("2 uncertain artist offers become sensible service categories", () => {
  const result = synthesizeBusinessReviewRecommendations(artistDna());
  assert.deepEqual(result.offer.strongestOffers, [
    "Custom portrait commissions", "Canvas artwork", "Wall murals", "Commercial and interior art commissions",
  ]);
});

test("3 concrete customer and offer answers are preserved exactly", () => {
  const dna = artistDna({ customers: { desiredCustomers: "Pet owners seeking portraits" }, offer: { strongestOffers: ["Pet portraits"] } });
  assert.deepEqual(synthesizeBusinessReviewRecommendations(dna), dna);
});

test("4 synthesized recommendations remain editable review fields", () => {
  const synthesized = synthesizeBusinessReviewRecommendations(artistDna());
  const sections = buildBusinessReviewSections(synthesized);
  assert.equal(sections.flatMap((section) => section.items).find((item) => item.path === "customers.desiredCustomers")?.value.includes("custom portraits"), true);
  assert.equal(sections.flatMap((section) => section.items).find((item) => item.path === "offer.strongestOffers")?.value.includes("Wall murals"), true);
  const edited = { ...synthesized, customers: { ...synthesized.customers, desiredCustomers: "Collectors seeking original local art" } };
  assert.equal(synthesizeBusinessReviewRecommendations(edited).customers.desiredCustomers, "Collectors seeking original local art");
});

test("5 review promises all seven actual business-build deliverables", () => {
  assert.deepEqual(BUSINESS_BUILD_DELIVERABLES, [
    "Brand identity and positioning", "Services and offer structure", "Website and customer-facing copy",
    "Marketing starter content", "Search and local visibility foundations", "Customer journey and lead path", "A practical launch plan",
  ]);
});

test("6 legacy plan-only wording and confirmation copy are removed", async () => {
  const page = await readFile("app/onboarding/page.tsx", "utf8");
  assert.match(page, /Here&apos;s what I understood/);
  assert.match(page, /Here&apos;s what Buzypeezy will build for you/);
  assert.match(page, /Looks Good — Continue/);
  assert.match(page, /Build My Business/);
  assert.doesNotMatch(page, /This is a plan only|Yes, this looks right/);
});

test("7 recommendation synthesis and review rendering make no provider or n8n calls", async () => {
  const source = await readFile("app/lib/business-intake-review.ts", "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|OpenAI|N8N|provider/i);
});

test("8 fresh dashboard intake clears stale idea handoff and does not load an existing project", async () => {
  const [dashboard, onboarding] = await Promise.all([
    readFile("app/dashboard/page.tsx", "utf8"), readFile("app/onboarding/page.tsx", "utf8"),
  ]);
  assert.match(dashboard, /sessionStorage\.removeItem\("easy-selected-business-idea"\); router\.push\("\/onboarding"\)/);
  assert.match(onboarding, /if \(id\)[\s\S]*authenticatedFetch\(`\/api\/projects\?projectId=/);
  assert.match(onboarding, /if \(!id\)[\s\S]*crypto\.randomUUID\(\)/);
  assert.doesNotMatch(synthesizeBusinessReviewRecommendations(artistDna()).identity.businessName, /3D Artist/);
});
