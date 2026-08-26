import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBusinessPreview } from "../../app/lib/business-preview.ts";
import {
  applyPreviewOverrides, PREVIEW_EDIT_RULES, validatePreviewOverrides,
} from "../../app/lib/business-preview-edits.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const output = (value) => ({ id: "00000000-0000-4000-8000-000000000001", output: value, approvedAt: new Date() });

function originalPreview() {
  return buildBusinessPreview({
    project: { id: "project-1", name: "BrightReach", companyName: "BrightReach", industry: "Marketing", goal: "More leads", businessDescription: "Agency" },
    outputs: new Map([
      ["branding", output({ brandName: "BrightReach", tagline: "Original tagline", brandVoice: "Clear and confident", colorPalette: "Navy #0A4D8C", typography: "Poppins", logoConcept: "Path" })],
      ["website", output({ websiteOverview: "Original supporting text", recommendedPages: "Home — Intro; Services — Offers; Work — Proof", websiteFeatures: "Forms", designRecommendations: "Simple", websiteGoal: "Leads", colourScheme: "Navy", typography: "Poppins", recommendedTechStack: "Next", seoRecommendations: "Local", siteStructure: "Home", websiteEdits: { companyName: "BrightReach", heroHeadline: "Original headline", heroDescription: "Original supporting text", aboutText: "Original value", servicesText: "Home — Intro; Services — Offers; Work — Proof", phone: "123", email: "hello@example.com", address: "Bangalore", whatsapp: "123", primaryCtaLabel: "Book now", primaryCtaLink: "/contact", template: "Modern" } })],
      ["marketing", output({ marketingStrategy: "Original positioning", contentIdeas: "Proof", socialMediaStrategy: "Social", adCopy: "Ad", contentCalendar: "Calendar", targetAudienceAnalysis: "MSMEs", emailMarketing: "Email", paidAdsStrategy: "Ads", typography: "Poppins", recommendedTechStack: "CRM", seoRecommendations: "Local", funnelSuggestions: "Funnel", kpis: "Leads", growthRecommendations: "Grow", marketingScore: "80", bestChannels: "Search", campaignTimeline: "Timeline", customerJourney: "Journey", contentMix: "Mix" })],
      ["seo", output({ seoAudit: "Audit", keywords: "marketing", metaTitles: "Original title", metaDescriptions: "Original description", internalLinking: "Links", blogTopics: "Topics", technicalSEO: "Technical", kpis: "Traffic", growthRecommendations: "Local" })],
      ["sales", output({ executiveSummary: "Summary", targetCustomerProfile: "MSMEs", salesFunnel: "Funnel", leadGenerationStrategy: "Leads", salesChannels: "Phone", outreachStrategy: "Book a consultation", pricingRecommendations: "Pricing", salesKPIs: "KPIs", actionPlan: "Plan", salesScript: "Script", proposal: "Proposal", closingStrategy: "Close" })],
    ]),
  });
}

test("valid manual edits normalize and apply without mutating the generated baseline", () => {
  const original = originalPreview();
  const before = structuredClone(original);
  const checked = validatePreviewOverrides({
    "website.heroHeadline": "  A clearer headline  ",
    "brand.tagline": "Growth made practical",
  }, original);
  assert.equal(checked.valid, true);
  if (!checked.valid) return;
  const edited = applyPreviewOverrides(original, checked.overrides);
  assert.equal(edited.website?.heroHeadline, "A clearer headline");
  assert.equal(edited.brand?.tagline, "Growth made practical");
  assert.deepEqual(original, before);
});

test("unknown, unavailable, oversized, empty, and HTML edit payloads are rejected", () => {
  const original = originalPreview();
  assert.equal(validatePreviewOverrides({ "website.rawCss": "body{}" }, original).valid, false);
  assert.equal(validatePreviewOverrides({ "website.contactCta": "Contact" }, original).valid, false);
  assert.equal(validatePreviewOverrides({ "search.title": "x".repeat(PREVIEW_EDIT_RULES["search.title"].maximum + 1) }, original).valid, false);
  assert.equal(validatePreviewOverrides({ "brand.tagline": "   " }, original).valid, false);
  assert.equal(validatePreviewOverrides({ "website.heroHeadline": "<script>alert(1)</script>" }, original).valid, false);
});

test("edit persistence is owner scoped, exact-keyed, revisioned, and never updates project outputs", async () => {
  const route = await source("app/api/business-preview/edits/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /Object\.keys\(body\)\.some/);
  assert.match(route, /validatePreviewOverrides/);
  assert.match(route, /insert\(projectPreviewCustomizations\)/);
  assert.match(route, /revisionCount: sql/);
  assert.match(route, /approvedAt: null/);
  assert.doesNotMatch(route, /update\(projectOutputs\)|projectBusinessDna\)\.set|fetch\(|OpenAI|N8N_|publish|regenerate/);
});

test("Edit mode is live and Save, Cancel, Reset remain manual and provider free", async () => {
  const page = await source("app/business-preview/page.tsx");
  assert.match(page, />Edit<\/button>/);
  assert.match(page, /type="button" aria-expanded=\{editing\}/);
  assert.match(page, /event\.preventDefault\(\); startEditing\(\)/);
  assert.match(page, /Edit Preview/);
  assert.match(page, /Save Changes/);
  assert.match(page, /Cancel/);
  assert.match(page, /Reset to Original/);
  assert.match(page, /applyPreviewOverrides\(originalPreview, next\)/);
  assert.match(page, /method: "PUT"/);
  assert.match(page, /\/api\/business-preview\/edits/);
  assert.match(page, /useSearchParams\(\)\.get\("projectId"\)/);
  assert.doesNotMatch(page, /\/onboarding|router\.push|router\.replace|window\.location|Build My Business/i);
  assert.match(page, /Images can be added later/);
  assert.match(page, /\["desktop", "tablet", "mobile"\]/);
  for (const label of ["Brand", "Website", "Marketing", "Search", "Customer Journey"]) assert.match(page, new RegExp(`\\b${label}\\b`));
  assert.doesNotMatch(page, /OpenAI|n8n|provider|Rewrite with AI|publish|regenerate/i);
});

test("saved edits reload through the customization layer and current-edit approval is invalidated", async () => {
  const route = await source("app/api/business-preview/route.ts");
  assert.match(route, /projectPreviewCustomizations/);
  assert.match(route, /applyPreviewOverrides\(originalPreview, overrides\)/);
  assert.match(route, /Boolean\(customization\?\.approvedAt\)/);
  assert.match(route, /update\(projectPreviewCustomizations\)\.set\(\{ approvedAt, updatedAt: approvedAt \}\)/);
  assert.doesNotMatch(route, /update\(projectOutputs\).*approvedAt: null/s);
});

test("business preview API converts unexpected database failures into safe JSON responses", async () => {
  const route = await source("app/api/business-preview/route.ts");
  assert.match(route, /try \{ return await loadBusinessPreview\(request\); \}/);
  assert.match(route, /catch \(error\) \{ return unexpectedJsonError\(error, "load"\); \}/);
  assert.match(route, /Response\.json\(/);
  assert.match(route, /status: 500/);
  assert.match(route, /Unable to load your business preview\./);
  assert.match(route, /code\.slice\(0, 32\)/);
  assert.doesNotMatch(route, /JSON\.stringify\(error\)|error\.message/);
});

test("migration creates a separate project-owned customization model", async () => {
  const migration = await source("drizzle/0017_add-project-preview-customizations.sql");
  assert.match(migration, /CREATE TABLE "project_preview_customizations"/);
  assert.match(migration, /"project_id" text PRIMARY KEY/);
  assert.match(migration, /"user_id" text NOT NULL/);
  assert.match(migration, /"overrides" jsonb/);
  assert.match(migration, /ON DELETE cascade/);
  assert.doesNotMatch(migration, /project_outputs|project_business_dna|DROP|DELETE FROM/i);
});
