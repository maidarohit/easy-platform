import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import { publicBusinessView, publicSeoDescription, publicSeoTitle } from "../../app/lib/public-business-presentation.ts";

const preview = (search = {}) => ({
  projectId: "private-project", business: { name: "Strongest Interiors", industry: "Interior Designer", goal: "Enquiries", description: "Interior design for homes and workplaces in Bengaluru." },
  brand: { name: "Strongest Interiors", tagline: "Spaces designed around you", colours: ["#173D32"], colourDirection: null, typography: null, voice: null, logoConcept: null, story: null },
  website: { heroHeadline: "Thoughtful interiors for everyday life", supportingText: "Plan a considered interior for your home or workplace.", primaryCta: "Contact us", services: "Interior design", serviceCards: [], trust: null, about: null, features: null, contact: null },
  marketing: { positioning: "Private positioning", campaign: "Private campaign", audience: "Private audience", socialCards: [], campaignCards: [] },
  search: { positioning: "Private keyword strategy", keywords: "private keyword table", keywordTags: ["private"], localFocus: "Private local plan", title: null, description: null, ...search },
  journey: { primaryCta: "Private sales sequence", customerJourney: "Private journey" }, approval: { approved: true, outputIds: ["private-output"] },
});

const published = (search = {}) => buildPublishedBusinessSnapshot(preview(search));

test("safe saved SEO metadata is public and the title contains the real business name", () => {
  const value = published({ title: "Interior Designer in Bengaluru | Strongest Interiors", description: "Interior design for homes and workplaces in Bengaluru." });
  assert.equal(publicSeoTitle(value), "Interior Designer in Bengaluru | Strongest Interiors");
  assert.equal(publicSeoDescription(value), "Interior design for homes and workplaces in Bengaluru.");
});

test("unsupported trials, results, multipliers, metrics, pricing, and placeholders are rejected", () => {
  for (const unsafe of ["Start Free Trial with Strongest Interiors", "Strongest Interiors - Real Results", "Get 3x leads with Strongest Interiors", "Strongest Interiors - 42% more traffic", "Strongest Interiors - 9,400 visitors", "Strongest Interiors - $X", "Strongest Interiors - TBD", "Strongest Interiors - Guaranteed ranking"]) {
    const value = published({ title: unsafe, description: unsafe });
    assert.notEqual(publicSeoTitle(value), unsafe);
    assert.notEqual(publicSeoDescription(value), unsafe);
    assert.doesNotMatch(`${publicSeoTitle(value)} ${publicSeoDescription(value)}`, /free trial|real results|3x|42%|9,400|\$X|TBD|guaranteed/i);
  }
});

test("unsafe SEO output falls back only to approved business copy and missing copy stays omitted", () => {
  const safeFallback = published({ title: "Get 3x leads", description: "Get 3x leads with real results." });
  assert.equal(publicSeoTitle(safeFallback), "Interior Designer | Strongest Interiors");
  assert.equal(publicSeoDescription(safeFallback), "Plan a considered interior for your home or workplace.");
  const missing = buildPublishedBusinessSnapshot({ ...preview(null), business: { name: "Plain Business", industry: null, goal: null, description: null }, brand: null, website: null, search: null });
  assert.equal(publicSeoTitle(missing), "Plain Business");
  assert.equal(publicSeoDescription(missing), undefined);
});

test("private keyword, audit, KPI, growth, marketing, and sales strategy never enters the public view", () => {
  const value = published({ positioning: "SEO audit and growth recommendations with KPI targets", keywords: "keyword research table" });
  const view = publicBusinessView(value);
  assert.equal(value.marketing, null); assert.equal(value.journey, null);
  assert.equal(view.marketing, null); assert.equal(view.journey, null);
  assert.equal(view.search?.positioning, null); assert.equal(view.search?.keywords, null);
  assert.deepEqual(view.search?.keywordTags, []); assert.equal(view.search?.localFocus, null);
  assert.doesNotMatch(JSON.stringify(view), /keyword research|SEO audit|KPI targets|growth recommendations|sales sequence/i);
});

test("customer labels change without renaming SEO data contracts", async () => {
  const [page, contracts] = await Promise.all([
    readFile("app/seo-ai/page.tsx", "utf8"), readFile("app/lib/easy-mode-execution-contracts.ts", "utf8"),
  ]);
  assert.match(page, /Website \/ Content Style/);
  assert.match(page, /SEO Readiness Estimate/);
  assert.doesNotMatch(page, /addSection\("SEO Score"/);
  assert.match(page, /brandResult\.seoScore/); assert.match(page, /brandStyle/);
  assert.match(contracts, /seoScore/); assert.match(contracts, /brandStyle/);
});

test("public metadata remains server-rendered, canonical-aware, and provider-free", async () => {
  const page = await readFile("app/business/[slug]/page.tsx", "utf8");
  assert.match(page, /generateMetadata/); assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /openGraph/); assert.match(page, /robots: \{ index: true, follow: true \}/);
  assert.match(page, /<h1/); assert.match(page, /<h2/); assert.match(page, /alt=/);
  assert.doesNotMatch(page, /OpenAI|N8N_|Gemini|Search Console|Analytics|startAiUsage|fetch\s*\(/i);
});
