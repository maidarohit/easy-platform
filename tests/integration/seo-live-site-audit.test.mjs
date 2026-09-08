import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeSeoOpportunities } from "../../app/lib/seo-opportunity-safety.ts";
import { buildSeoSiteAudit } from "../../app/lib/seo-site-audit.ts";

test("published readiness is deterministic and excludes unavailable metrics", () => {
  const audit = buildSeoSiteAudit({
    published: true,
    publishedUrl: "https://buzypeezy.ai/business/example",
    title: "Example Business",
    metaDescription: "A factual description of the example business.",
    hasH1: true,
    hasOrderedHeadings: true,
    publicSectionCount: 3,
    internalLinkCount: 5,
    imageCount: 1,
    imagesHaveAltText: true,
    hasStructuredData: false,
  });
  assert.equal(audit.measuredChecks, 13);
  assert.equal(audit.passedChecks, 12);
  assert.equal(audit.score, 92);
  assert.equal(audit.checks.title.status, "pass");
  assert.equal(audit.checks.metaDescription.status, "pass");
  assert.equal(audit.checks.canonical.status, "pass");
  assert.equal(audit.checks.indexability.status, "pass");
  for (const metric of ["lcp", "inp", "cls", "backlinks", "keywordRankings", "domainAuthority"]) {
    assert.equal(audit.checks[metric].status, "not_measured");
  }
});

test("unpublished projects have no fabricated readiness score", () => {
  const audit = buildSeoSiteAudit({ published: false });
  assert.equal(audit.published, false);
  assert.equal(audit.score, null);
  assert.equal(audit.measuredChecks, 0);
  assert.equal(audit.checks.title.status, "not_applicable");
});

test("SEO opportunities remove unsupported claims and platform-inapplicable advice", () => {
  const output = normalizeSeoOpportunities({
    seoScore: "98/100",
    seoAudit: "Everything passes",
    kpis: "Traffic growth 80%",
    keywordResearch: "Affordable services. Guaranteed rankings. Useful customer questions.",
    technicalSEO: "Switch hosting to WordPress and Cloudflare. Improve clear page titles. Fix FID.",
    growthRecommendations: "Publish useful service guides. Expect 40% traffic growth.",
  });
  assert.equal(output.seoScore, undefined);
  assert.equal(output.seoAudit, undefined);
  assert.equal(output.kpis, undefined);
  assert.equal(output.keywordResearch, "Useful customer questions.");
  assert.equal(output.technicalSEO, "Improve clear page titles.");
  assert.equal(output.growthRecommendations, "Publish useful service guides.");
});

test("route scopes both publication systems to the authenticated owner", async () => {
  const route = await readFile("app/api/seo-ai/route.ts", "utf8");
  assert.match(route, /eq\(projects\.userId, uid\)/);
  assert.match(route, /eq\(businessPublications\.userId, uid\)/);
  assert.match(route, /eq\(publishedWebsites\.ownerUid, uid\)/);
  assert.match(route, /siteAudit, seoOpportunities/);
  assert.match(route, /recommendationRules: SEO_GROUNDING_RULES/);
});

test("the UI presents factual checks separately and never uses provider scores", async () => {
  const page = await readFile("app/seo-ai/page.tsx", "utf8");
  assert.match(page, /Measured from your published Buzypeezy website/);
  assert.match(page, /Publish your website to run a live website check/);
  assert.match(page, /AI recommendations based on your business and verified website data/);
  assert.doesNotMatch(page, /brandResult\.seoScore|Keyword Coverage|Optimization Areas/);
});
