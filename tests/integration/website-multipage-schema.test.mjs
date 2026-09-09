import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildMultiPageWebsitePublicationSnapshot, buildWebsitePublicationSnapshot, validateWebsitePublicationSnapshot } from "../../app/lib/website-publication.ts";
import { adaptLegacyWebsiteToSiteDocument, removeWebsitePage, validateWebsiteSiteDocument } from "../../app/lib/website-site-document.ts";

const output = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
const input = { companyName: "Example", industry: "Design", websiteGoal: "Leads", websiteRequirements: "Simple", template: "Modern", websiteOutput: output };

test("legacy one-page output adapts deterministically to a protected Home page", () => {
  const first = adaptLegacyWebsiteToSiteDocument(input);
  const second = adaptLegacyWebsiteToSiteDocument(input);
  assert.deepEqual(first, second);
  assert.equal(first.pages[0].id, "page-home");
  assert.equal(first.pages[0].path, "/");
  assert.deepEqual(first.pages[0].blocks.map(({ type }) => type), ["hero", "content", "services", "contact"]);
  assert.ok(validateWebsiteSiteDocument(first));
  assert.equal(removeWebsitePage(first, "page-home"), null);
});

test("valid multi-page documents accept typed pages and blocks", () => {
  const document = adaptLegacyWebsiteToSiteDocument(input);
  document.pages.push({ id: "page-about", type: "about", path: "/about", title: "About", order: 1, visibility: "visible", seo: { title: "About", description: "", canonicalPath: "/about", index: true }, blocks: [
    { id: "block-about-content", type: "content", order: 0, visibility: "visible", heading: "About", body: "Verified details" },
    { id: "block-about-service-detail", type: "serviceDetail", order: 1, visibility: "hidden", serviceId: "service-design", heading: "Design", body: "Details" },
    { id: "block-about-gallery", type: "gallery", order: 2, visibility: "visible", heading: "Projects", mediaIds: ["media-project-one"] },
    { id: "block-about-process", type: "process", order: 3, visibility: "visible", heading: "Process", steps: [{ id: "step-discover", title: "Discover", body: "Understand the brief" }] },
    { id: "block-about-faq", type: "faq", order: 4, visibility: "visible", heading: "FAQ", items: [{ id: "faq-timing", question: "How long?", answer: "Contact us for timing." }] },
    { id: "block-about-cta", type: "cta", order: 5, visibility: "visible", heading: "Start", body: "Get in touch", label: "Contact", href: "/contact" },
  ] });
  document.navigation.items.push({ id: "nav-about", pageId: "page-about", label: "About", order: 1, visibility: "visible" });
  assert.deepEqual(validateWebsiteSiteDocument(document), document);
  const removed = removeWebsitePage(document, "page-about");
  assert.ok(removed);
  assert.equal(removed.pages.length, 1);
});

test("duplicate and reserved paths are rejected", () => {
  const document = adaptLegacyWebsiteToSiteDocument(input);
  const page = { ...document.pages[0], id: "page-other", type: "custom", title: "Other", blocks: [] };
  assert.equal(validateWebsiteSiteDocument({ ...document, pages: [...document.pages, page] }), null);
  assert.equal(validateWebsiteSiteDocument({ ...document, pages: [document.pages[0], { ...page, path: "/api/private" }] }), null);
});

test("legacy snapshots remain schema-version-1 compatible and multi-page snapshots version atomically", () => {
  const legacy = buildWebsitePublicationSnapshot(input);
  assert.ok(legacy);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal("siteDocument" in legacy, false);
  assert.deepEqual(validateWebsitePublicationSnapshot(legacy), legacy);
  const siteDocument = adaptLegacyWebsiteToSiteDocument(input);
  const multiPage = buildMultiPageWebsitePublicationSnapshot({ ...input, siteDocument });
  assert.ok(multiPage);
  assert.equal(multiPage.schemaVersion, 2);
  assert.deepEqual(validateWebsitePublicationSnapshot(multiPage), multiPage);
});

test("publication ownership remains server-authoritative and outside the site document", async () => {
  const route = await readFile(new URL("../../app/api/website-publications/route.ts", import.meta.url), "utf8");
  assert.match(route, /eq\(projects\.userId, uid\)/);
  assert.match(route, /eq\(projectOutputs\.userId, authorized\.uid\)/);
  assert.doesNotMatch(route, /body\.(?:ownerUid|userId|siteDocument|snapshot)/);
  assert.equal(validateWebsiteSiteDocument({ ...adaptLegacyWebsiteToSiteDocument(input), ownerUid: "attacker" }), null);
});
