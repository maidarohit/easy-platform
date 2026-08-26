import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBusinessPreview, cleanFirstListCandidate, extractBrandColours,
  parseKeywordTags, parsePreviewCards,
} from "../../app/lib/business-preview.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const output = (id, value, approvedAt = null) => ({ id, output: value, approvedAt });

test("preview projects confirmed business identity and visual saved outputs without generation", () => {
  const preview = buildBusinessPreview({
    project: {
      id: "project-1", name: "Legacy name", companyName: "BrightReach Digital",
      industry: "Digital marketing", goal: "Generate qualified enquiries",
      businessDescription: "A Bangalore digital marketing agency.",
    },
    outputs: new Map([
      ["branding", output("brand-1", {
        brandName: "BrightReach Digital", tagline: "Local growth, made measurable",
        colorPalette: "Navy #0A4D8C, Orange #FF7A00", typography: "Poppins and Inter",
        brandVoice: "Clear, practical and confident", logoConcept: "A rising path symbol",
        story: "Built to make professional growth accessible.", marketingSuggestions: "Show local proof.",
      })],
      ["website", output("web-1", {
        websiteOverview: "A lead-first homepage.", recommendedPages: "Services, Work, About, Contact",
        websiteFeatures: "Fast quote form and booking.",
        websiteEdits: { heroHeadline: "Grow with clarity", heroDescription: "Practical digital growth.", primaryCtaLabel: "Book a consult" },
      })],
      ["marketing", output("marketing-1", {
        marketingStrategy: "Position around measurable local outcomes.", contentIdeas: "Share a client result.",
        socialMediaStrategy: "Use concise proof-led posts.", targetAudienceAnalysis: "Established local MSMEs.",
      })],
      ["seo", output("seo-1", { seoAudit: "Lead with Bangalore services.", keywords: "digital marketing Bangalore", metaTitles: "BrightReach Digital | Bangalore", metaDescriptions: "Local digital growth for MSMEs.", growthRecommendations: "Build local service pages." })],
      ["uiux", output("uiux-1", { userFlow: "Homepage to quick consult to follow-up.", userPersonas: "Time-poor local business owner." })],
      ["sales", output("sales-1", { leadGenerationStrategy: "Quick consultation.", salesFunnel: "Enquiry to qualification to proposal.", outreachStrategy: "Book a consult", targetCustomerProfile: "Established MSMEs." })],
    ]),
  });

  assert.equal(preview.business.name, "BrightReach Digital");
  assert.equal(preview.business.industry, "Digital marketing");
  assert.equal(preview.business.goal, "Generate qualified enquiries");
  assert.deepEqual(preview.brand?.colours, ["#0A4D8C", "#FF7A00"]);
  assert.equal(preview.website?.heroHeadline, "Grow with clarity");
  assert.equal(preview.website?.primaryCta, "Book a consult");
  assert.equal(preview.marketing?.socialCards.length, 2);
  assert.equal(preview.search?.title, "BrightReach Digital | Bangalore");
  assert.match(preview.journey?.enquiryPath ?? "", /qualification/);
});

test("missing optional saved fields stay absent and invalid colours are not fabricated", () => {
  const preview = buildBusinessPreview({
    project: { id: "project-2", name: "Business", companyName: null, industry: null, goal: null, businessDescription: null },
    outputs: new Map([["branding", output("brand-2", { brandName: "Business", colorPalette: "Warm and trustworthy" })]]),
  });
  assert.equal(preview.business.name, "Business");
  assert.equal(preview.business.industry, null);
  assert.deepEqual(preview.brand?.colours, []);
  assert.equal(preview.brand?.tagline, null);
  assert.equal(preview.website, null);
  assert.deepEqual(extractBrandColours("#123456, #123456, broken #123"), ["#123456"]);
});

test("saved website section lists become visual cards only when deterministic parsing is safe", () => {
  assert.deepEqual(parsePreviewCards(
    "Home — Main introduction; Services — What customers can buy; Work — Existing customer proof; Contact — Enquiry options",
  ), [
    { title: "Home", description: "Main introduction" },
    { title: "Services", description: "What customers can buy" },
    { title: "Work", description: "Existing customer proof" },
    { title: "Contact", description: "Enquiry options" },
  ]);
  assert.deepEqual(parsePreviewCards("A narrative that cannot be safely separated"), []);
});

test("search normalization selects one saved candidate and cleans keyword tags", () => {
  assert.equal(cleanFirstListCandidate("1. BrightReach Digital | Bangalore 2. Branding Services | BrightReach"), "BrightReach Digital | Bangalore");
  assert.equal(cleanFirstListCandidate("1) Local digital growth for MSMEs.\n2) Practical branding and websites."), "Local digital growth for MSMEs.");
  assert.deepEqual(parseKeywordTags("1. digital marketing Bangalore, 2. branding services; qualified enquiries"), [
    "digital marketing Bangalore", "branding services", "qualified enquiries",
  ]);
});

test("presentation mapping retains complete saved text and does not mutate source outputs", () => {
  const longPositioning = "Saved positioning ".repeat(80).trim();
  const marketing = Object.freeze({ marketingStrategy: longPositioning, contentIdeas: "1. Proof post; 2. Local case study" });
  const outputs = new Map([["marketing", output("marketing-1", marketing)]]);
  const before = JSON.stringify(marketing);
  const preview = buildBusinessPreview({
    project: { id: "project-3", name: "Business", companyName: null, industry: null, goal: null, businessDescription: null },
    outputs,
  });
  assert.equal(preview.marketing?.positioning, longPositioning);
  assert.deepEqual(preview.marketing?.campaignCards, ["Proof post", "Local case study"]);
  assert.equal(JSON.stringify(marketing), before);
});

test("preview route reads validated saved outputs and approval only timestamps those outputs", async () => {
  const route = await source("app/api/business-preview/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /selectLatestWorkspaceOutputs\(outputs\)/);
  assert.match(route, /eq\(projectBusinessDna\.confirmed, true\)/);
  assert.match(route, /transaction\.update\(projectOutputs\)\.set\(\{ approvedAt \}\)/);
  assert.match(route, /isNull\(projectOutputs\.approvedAt\)/);
  assert.doesNotMatch(route, /fetch\(|N8N_|startAiUsage|completeAiUsage|publish|insert\(|delete\(/);
});

test("customer preview provides all viewports and never exposes specialist AI navigation", async () => {
  const page = await source("app/business-preview/page.tsx");
  for (const label of ["Brand", "Website", "Marketing", "Search", "Customer Journey"]) {
    assert.match(page, new RegExp(`\\b${label}\\b`));
  }
  assert.match(page, /\["desktop", "tablet", "mobile"\]/);
  for (const technical of ["Branding AI", "Website AI", "SEO AI", "UIUX AI", "Sales AI"]) {
    assert.doesNotMatch(page, new RegExp(technical));
  }
  assert.match(page, /method: "POST"/);
  assert.match(page, /View more/);
  assert.match(page, /website\.serviceCards\.map/);
  assert.match(page, /marketing\.campaignCards\.map/);
  assert.match(page, /search\.keywordTags\.map/);
  assert.match(page, /\/api\/business-preview/);
  assert.doesNotMatch(page, /regenerate|\/api\/easy-mode|\/api\/business-dna\/analyze/i);
});

test("Master Workspace opens the active project preview and refresh only reloads saved data", async () => {
  const [workspace, previewPage] = await Promise.all([
    source("app/master-workspace/page.tsx"), source("app/business-preview/page.tsx"),
  ]);
  assert.match(workspace, /Preview (?:& Edit My Business|, Edit & Publish)/);
  assert.match(workspace, /projectLink\("\/business-preview"\)/);
  assert.match(previewPage, /cache: "no-store"/);
  assert.doesNotMatch(previewPage, /\/api\/(?:easy-mode|business-dna\/analyze)|openai|n8n|provider/i);
});
