import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addEssentialWebsitePages } from "../../app/lib/website-essential-pages.ts";
import { adaptLegacyWebsiteToSiteDocument, addWebsitePage, validateWebsiteSiteDocument } from "../../app/lib/website-site-document.ts";
import { publicWebsitePageSeo, resolvePublishedWebsitePage, visiblePublishedWebsitePages } from "../../app/lib/website-site-presentation.ts";
import { buildWebsitePublicationSnapshot } from "../../app/lib/website-publication.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const output = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
function site() {
  let document = adaptLegacyWebsiteToSiteDocument({ companyName: "Example", template: "Modern", websiteOutput: output });
  document = addWebsitePage(document, { title: "About", path: "/about", type: "about" });
  return addEssentialWebsitePages(document, { services: [{ id: "service-one", name: "Design", slug: "design", description: "Design services" }], projectMedia: ["/uploads/project.jpg"] });
}

test("public resolution supports only the allowed visible page patterns and matching types", () => {
  const document = site();
  for (const path of ["/", "/about", "/services", "/services/design", "/projects", "/process", "/faq", "/contact"]) assert.ok(resolvePublishedWebsitePage(document, path), path);
  assert.ok(visiblePublishedWebsitePages(document).some((page) => page.path.startsWith("/projects/") && page.type === "project"));
  assert.equal(resolvePublishedWebsitePage(document, "/custom"), null);
  const mismatched = validateWebsiteSiteDocument({ ...document, pages: document.pages.map((page) => page.path === "/about" ? { ...page, type: "custom" } : page) });
  assert.ok(mismatched);
  assert.equal(resolvePublishedWebsitePage(mismatched, "/about"), null);
});

test("hidden and removed published pages do not resolve or enter the sitemap set", () => {
  const document = site();
  const hidden = validateWebsiteSiteDocument({ ...document, pages: document.pages.map((page) => page.path === "/faq" ? { ...page, visibility: "hidden" } : page) });
  assert.equal(resolvePublishedWebsitePage(hidden, "/faq"), null);
  assert.ok(!visiblePublishedWebsitePages(hidden).some((page) => page.path === "/faq"));
});

test("per-page SEO returns safe title, description, canonical path, and robots state", () => {
  const document = site();
  const withSeo = validateWebsiteSiteDocument({ ...document, pages: document.pages.map((page) => page.path === "/services" ? { ...page, seo: { title: "Our Services", description: "Explore verified services.", canonicalPath: "/services", index: false } } : page) });
  assert.deepEqual(publicWebsitePageSeo(withSeo, "/services"), { title: "Our Services", description: "Explore verified services.", canonicalPath: "/services", index: false });
  assert.equal(publicWebsitePageSeo(withSeo, "/api/private"), null);
});

test("catch-all routing and sitemap use only the active current immutable publication", async () => {
  const [route, loader, sitemap, publicationApi] = await Promise.all([
    source("app/published-sites/[slug]/[...path]/page.tsx"), source("app/lib/public-website-publication.ts"), source("app/sitemap.ts"), source("app/api/website-publications/route.ts"),
  ]);
  assert.match(route, /snapshot\.schemaVersion !== 2/);
  assert.match(route, /resolvePublishedWebsitePage/);
  assert.match(route, /publicWebsitePageSeo/);
  assert.match(route, /segments\.length > 2/);
  assert.match(loader, /eq\(publishedWebsites\.status, "active"\)/);
  assert.match(loader, /eq\(websitePublicationVersions\.versionNumber, publishedWebsites\.currentVersion\)/);
  assert.match(loader, /hasPaidProductAccess\(row\.userId\)/);
  assert.match(sitemap, /visiblePublishedWebsitePages\(snapshot\.siteDocument\)/);
  assert.match(sitemap, /websitePublicationVersions\.versionNumber, publishedWebsites\.currentVersion/);
  assert.match(publicationApi, /buildMultiPageWebsitePublicationSnapshot/);
  assert.doesNotMatch(route + loader + sitemap, /OpenAI|N8N_|Gemini|startAiUsage/i);
});

test("schema-v1 snapshots and root rendering remain compatible", async () => {
  const legacy = buildWebsitePublicationSnapshot({ companyName: "Example", industry: "Design", websiteGoal: "Contact", websiteRequirements: "", template: "Modern", websiteOutput: output });
  assert.equal(legacy.schemaVersion, 1);
  const [root, subpage] = await Promise.all([source("app/published-sites/[slug]/page.tsx"), source("app/published-sites/[slug]/[...path]/page.tsx")]);
  assert.match(root, /snapshot\.schemaVersion === 2 \? publicWebsitePageSeo/);
  assert.match(root, /publicWebsiteSeoTitle\(snapshot\)/);
  assert.match(subpage, /snapshot\.schemaVersion !== 2/);
});
