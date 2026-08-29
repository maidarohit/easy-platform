import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublishedBusinessSnapshot, validatePublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import {
  publicAudience, publicBusinessKind, publicCallToAction, publicContact, publicProcess,
  publicServices, publicSocialLinks, publicStory, publicValuePoints,
} from "../../app/lib/public-business-presentation.ts";

const snapshot = (overrides = {}) => buildPublishedBusinessSnapshot({
  projectId: "private", business: { name: "Example", industry: "Consulting", goal: "Enquiries", description: "Practical guidance for growing businesses." },
  brand: { name: "Example", tagline: "Move forward with clarity", colours: ["#173D32", "#EEE9DC"], colourDirection: null, typography: null, voice: "Clear and dependable", logoConcept: null, story: "We help clients make confident decisions." },
  website: { heroHeadline: "Confident decisions for growing teams", supportingText: "Clear advice shaped around your needs.", primaryCta: "Book a consultation", services: "Strategy consulting; Growth consulting", serviceCards: [], trust: "A clear, collaborative process", about: "We combine practical experience with attentive service.", features: "Tailored recommendations", contact: "hello@example.com" },
  marketing: { positioning: "Trusted advice", campaign: null, audience: "Founders; Growing business teams", socialCards: [], campaignCards: [] },
  search: { positioning: null, keywords: "business consulting", keywordTags: [], localFocus: null, title: "Example Consulting", description: "Practical consulting for growing businesses." },
  journey: { leadAction: null, enquiryPath: "Explore → Contact → Consultation → Recommendation", primaryCta: null, customerJourney: "Explore → Contact → Consultation → Recommendation", audience: "Founders; Growing business teams" },
  approval: { approved: true, outputIds: ["one"] }, ...overrides,
});

test("artist/service presentation exposes saved offers, audiences, portfolio treatment and process", () => {
  const value = snapshot({ business: { name: "3D Artist", industry: "Painting artist", goal: "Commissions", description: "Custom portraits, canvas artwork and wall murals for homes and commercial spaces." }, website: { heroHeadline: "Art made personal", supportingText: "Commission distinctive artwork for your space.", primaryCta: "Start a commission", services: "Custom portraits; Canvas artwork; Wall murals", serviceCards: [], trust: "Collaborative creative process", about: "An independent artist creating meaningful work.", features: null, contact: null }, marketing: { positioning: null, campaign: null, audience: "Families; Homeowners; Interior designers; Commercial spaces", socialCards: [], campaignCards: [] }, search: null, journey: { leadAction: null, enquiryPath: "Discover → Share your idea → Approve direction → Receive artwork", primaryCta: null, customerJourney: "Discover → Share your idea → Approve direction → Receive artwork", audience: "Families; Homeowners; Interior designers; Commercial spaces" } });
  assert.deepEqual(publicServices(value).map((item) => item.title), ["Custom portraits", "Canvas artwork", "Wall murals"]);
  assert.equal(publicAudience(value).length, 4);
  assert.equal(publicBusinessKind(value).workLabel, "Selected work");
  assert.ok(publicProcess(value).length >= 3);
});

test("local business gets local experience treatment", () => assert.equal(publicBusinessKind(snapshot({ business: { name: "Cafe", industry: "Local cafe", goal: null, description: "Neighbourhood cafe" } })).workLabel, "The experience"));
test("B2B business gets company-facing capabilities", () => assert.deepEqual(publicBusinessKind(snapshot({ business: { name: "Works", industry: "Industrial manufacturer", goal: null, description: "Components for enterprises" } })), { workLabel: "Capabilities", audienceLabel: "Who we work with", b2b: true }));
test("consultant gets expertise treatment", () => assert.equal(publicBusinessKind(snapshot()).workLabel, "Expertise"));
test("product business gets range and ordering process", () => {
  const value = snapshot({ business: { name: "Shop", industry: "Ecommerce product store", goal: null, description: "Useful home products" }, journey: null });
  assert.equal(publicBusinessKind(value).workLabel, "Featured range");
  assert.match(publicProcess(value).join(" "), /range|order/i);
});

test("missing optional fields and visuals retain safe deterministic fallbacks", () => {
  const value = snapshot({ brand: null, website: null, marketing: null, search: null, journey: null });
  assert.deepEqual(publicServices(value), []);
  assert.equal(publicCallToAction(value), "Get in Touch");
  assert.equal(publicContact(value).label, null);
  assert.equal(publicProcess(value).length, 3);
});

test("unverified social strategy URLs never become public social links", () => {
  const value = snapshot({ marketing: { positioning: null, campaign: null, audience: null, socialCards: ["Post at https://instagram.com/example"], campaignCards: [] } });
  assert.deepEqual(publicSocialLinks(value), []);
});

test("internal strategies and fabricated proof are excluded", () => {
  const value = snapshot({ website: { ...snapshot().website, trust: "KPI strategy and conversion rate targets", about: "Sales script and cold email sequence" }, journey: { leadAction: null, enquiryPath: "Day 1 cold email → Day 3 follow-up", primaryCta: "Outreach sequence", customerJourney: "Sales script", audience: "Persona 1: Business owners" } });
  assert.doesNotMatch(publicValuePoints(value).map((item) => item.title).join(" "), /KPI|conversion rate/i);
  assert.notEqual(publicStory(value), "Sales script and cold email sequence");
  assert.equal(publicCallToAction(value), "Book a consultation");
  assert.doesNotMatch(publicProcess(value).join(" "), /cold email|follow-up/i);
});

test("legacy generated contact is private until explicitly approved", () => {
  assert.deepEqual(publicContact(snapshot()), { label: null, href: "#contact", methods: [], location: null });
});

test("existing schema-version-one publication snapshots remain valid and stable", () => {
  const current = snapshot(); const value = { ...current, schemaVersion: 1 }; delete value.contact; const before = structuredClone(value);
  assert.deepEqual(validatePublishedBusinessSnapshot(value), value);
  publicAudience(value); publicServices(value); publicProcess(value);
  assert.deepEqual(value, before);
});

test("legacy public snapshots prefer saved brand names and cannot expose bracket placeholders", () => {
  const value = snapshot({
    business: { name: "interior designer", industry: "Interiors", goal: null, description: "Design by [Company Name]." },
    brand: { ...snapshot().brand, name: "Strongest Interiors", tagline: "Welcome to [Brand Name]" },
    search: { ...snapshot().search, title: "Interior Design | [Brand Name]", description: "Meet [Business Name] [Draft Text]" },
  });
  assert.equal(value.business.name, "Strongest Interiors");
  assert.equal(value.search?.title, "Interior Design | Strongest Interiors");
  assert.doesNotMatch(JSON.stringify(value), /\[(?:brand|company|business|draft)/i);
});

test("renderer is responsive, semantic, snapshot-only and provider-free", async () => {
  const page = await readFile("app/business/[slug]/page.tsx", "utf8");
  assert.match(page, /sticky top-0/); assert.match(page, /sm:grid-cols-2|md:grid-cols-2/); assert.match(page, /lg:grid-cols/);
  assert.match(page, /<header/); assert.match(page, /Mobile navigation/); assert.match(page, /id="work"/); assert.match(page, /<footer/); assert.match(page, /openGraph/);
  assert.match(page, /heroCopy/); assert.match(page, /publicSeoDescription/); assert.doesNotMatch(page, /snapshot\.website\.supportingText/);
  assert.doesNotMatch(page, /verifyFirebaseIdToken|projectMemory|projectOutputs|fetch\s*\(|OPENAI|N8N_|Image AI|startAiUsage/i);
});

test("snapshot renderer contains no testimonial, award, client-logo or invented metric claims", async () => {
  const page = await readFile("app/business/[slug]/page.tsx", "utf8");
  assert.doesNotMatch(page, /testimonial|award|certification|five-star|trusted by \d|client logos?|\d+ customers/i);
});
