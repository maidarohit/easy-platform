import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildPublishedBusinessSnapshot, validatePublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import { adaptLegacyWebsiteToSiteDocument, addWebsitePage } from "../../app/lib/website-site-document.ts";
import { publicWebsitePageBlocks, safeWebsiteBlockText, visibleWebsiteNavigation } from "../../app/lib/website-site-presentation.ts";
import { validateWebsiteOutput } from "../../app/lib/easy-mode-execution-contracts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const websiteOutput = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
const preview = { business: { name: "Example", industry: "Design", goal: null, description: "Interior design services." }, brand: null, website: { heroHeadline: "Designed for living", supportingText: "Interior design services.", primaryCta: "Contact", services: "Interior design", serviceCards: [], trust: null, about: null, features: null, contact: null, heroImage: "/uploads/hero.jpg", secondaryImage: null, businessVideo: null }, marketing: null, search: null, journey: null, approval: { approved: true, outputIds: ["website-row"] } };

function document() {
  let value = adaptLegacyWebsiteToSiteDocument({ companyName: "Example", template: "Modern", websiteOutput });
  value = addWebsitePage(value, { title: "Projects", path: "/projects", type: "portfolio" });
  return addWebsitePage(value, { title: "FAQ", path: "/faq", type: "faq" });
}

function fullDocument() {
  let value = document();
  value = addWebsitePage(value, { title: "About", path: "/about", type: "about" });
  value = addWebsitePage(value, { title: "Services", path: "/services", type: "services" });
  return addWebsitePage(value, { title: "Contact", path: "/contact", type: "contact" });
}

test("schema-v2 business root uses the shared multi-page renderer", async () => {
  const root = await source("app/business/[slug]/page.tsx");
  assert.match(root, /snapshot\.siteDocument[\s\S]*WebsiteSiteRenderer[\s\S]*pagePath="\/"[\s\S]*basePath=\{`\/business\/[\s\S]*publicPageOnly/);
  assert.deepEqual(publicWebsitePageBlocks(fullDocument(), "/").map((block) => block.type), ["hero"]);
});

test("schema-v2 business child routes resolve only published document pages", async () => {
  const child = await source("app/business/[slug]/[...path]/page.tsx");
  assert.match(child, /resolvePublishedWebsitePage\(snapshot\.siteDocument, path\)/);
  assert.match(child, /WebsiteSiteRenderer[\s\S]*pagePath=\{loaded\.path\}/);
  assert.match(child, /pagePath=\{loaded\.path\}[\s\S]*publicPageOnly/);
  assert.match(child, /segments\.length < 1 \|\| segments\.length > 2/);
  assert.deepEqual(publicWebsitePageBlocks(fullDocument(), "/services"), []);
});

test("visible Projects and FAQ pages appear as real-path navigation", () => {
  const value = document();
  const pages = new Map(value.pages.map((page) => [page.id, page.path]));
  assert.deepEqual(visibleWebsiteNavigation(value).map((item) => pages.get(item.pageId)), ["/", "/projects", "/faq"]);
});

test("schema-v2 renderer prefixes navigation paths while schema-v1 keeps anchors", async () => {
  const [renderer, root] = await Promise.all([source("app/dashboard/components/WebsiteSiteRenderer.tsx"), source("app/business/[slug]/page.tsx")]);
  assert.match(renderer, /href=\{pages\.get\(item\.pageId\)!\.path\}[\s\S]*basePath=\{basePath\}/);
  assert.match(renderer, /href === "\/" \? basePath : `\$\{basePath\}\$\{href\}`/);
  assert.match(root, /const nav = uniquePublicNavigationItems\(\[\{ href: "#home"/);
});

test("republish reads the latest persisted schema-v2 document before the legacy preview adapter", async () => {
  const [api, loader] = await Promise.all([source("app/api/business-publications/route.ts"), source("app/lib/public-business-publication.ts")]);
  const savedDraft = { ...websiteOutput, siteDocument: document() };
  assert.equal(validateWebsiteOutput(savedDraft), null);
  assert.match(api, /latestStoredWebsiteSiteDocument\(outputRows\)/);
  assert.match(api, /JSON\.parse\(row\.result\)[\s\S]*validateWebsiteSiteDocument\(output\.siteDocument\)/);
  assert.match(api, /orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\), desc\(projectOutputs\.id\)\)/);
  assert.match(api, /buildPublishedBusinessSnapshot\(preview, contactRows\[0\]\?\.settings \?\? \{\}, siteDocument \?\? undefined\)/);
  assert.match(loader, /businessPublicationVersions\.versionNumber, businessPublications\.currentVersion/);
  assert.doesNotMatch(api + loader, /OpenAI|N8N_|startAiUsage|fetch\s*\(/i);
});

test("schema-v1 business snapshots remain unchanged", () => {
  const current = buildPublishedBusinessSnapshot(preview);
  const legacy = { ...current, schemaVersion: 1 }; delete legacy.contact;
  assert.deepEqual(validatePublishedBusinessSnapshot(legacy), legacy);
  assert.equal("siteDocument" in legacy, false);
});

test("shared rendering removes internal instructions and unverified history", () => {
  assert.equal(safeWebsiteBlockText("Describe operating history only when the owner provides verified dates."), "");
  assert.equal(safeWebsiteBlockText("We started as a small team of architects and craftsmen."), "");
  assert.equal(safeWebsiteBlockText("Project brief: create a premium lead-generation website."), "");
  const snapshot = buildPublishedBusinessSnapshot(preview, {}, document());
  assert.ok(snapshot.siteDocument);
});
