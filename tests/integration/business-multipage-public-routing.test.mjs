import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildPublishedBusinessSnapshot, validatePublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import { adaptLegacyWebsiteToSiteDocument, addWebsitePage, validateWebsiteSiteDocument } from "../../app/lib/website-site-document.ts";
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
  value = addWebsitePage(value, { title: "Process", path: "/process", type: "process" });
  return addWebsitePage(value, { title: "Contact", path: "/contact", type: "contact" });
}

function pageResolutionDocument() {
  const value = fullDocument();
  return validateWebsiteSiteDocument({ ...value, pages: value.pages.map((page) => {
    if (page.path === "/contact") return { ...page, blocks: [{ id: "block-contact-page", type: "contact", order: 0, visibility: "visible", heading: "Contact us", body: "Send an enquiry." }] };
    if (page.path === "/services") return { ...page, blocks: [{ id: "block-services-page", type: "services", order: 0, visibility: "visible", heading: "Services", introduction: "Interior design", serviceIds: [] }] };
    if (page.path === "/projects") return { ...page, blocks: [{ id: "block-projects-page", type: "gallery", order: 0, visibility: "visible", heading: "Projects", mediaIds: ["media-project-one"] }] };
    if (page.path === "/process") return { ...page, blocks: [{ id: "block-process-page", type: "process", order: 0, visibility: "visible", heading: "Process", steps: [] }] };
    return page;
  }) });
}

test("schema-v2 business root uses the shared multi-page renderer", async () => {
  const root = await source("app/business/[slug]/page.tsx");
  assert.match(root, /snapshot\.siteDocument[\s\S]*WebsiteSiteRenderer[\s\S]*pagePath="\/"[\s\S]*basePath=\{`\/business\/[\s\S]*publicPageOnly/);
});

test("schema-v2 business child routes resolve only published document pages", async () => {
  const child = await source("app/business/[slug]/[...path]/page.tsx");
  assert.match(child, /resolvePublishedWebsitePage\(snapshot\.siteDocument, path\)/);
  assert.match(child, /WebsiteSiteRenderer[\s\S]*pagePath=\{loaded\.path\}/);
  assert.match(child, /pagePath=\{loaded\.path\}[\s\S]*publicPageOnly/);
  assert.match(child, /segments\.length < 1 \|\| segments\.length > 2/);
});

test("schema-v2 root and child resolution return only their exact page block sets", () => {
  const value = pageResolutionDocument();
  assert.ok(value);
  assert.deepEqual(publicWebsitePageBlocks(value, "/").map((block) => block.id), ["block-home-hero", "block-home-services", "block-home-projects-preview", "block-home-process-preview", "block-home-content", "block-home-final-cta"]);
  assert.deepEqual(publicWebsitePageBlocks(value, "/services").map((block) => block.id), ["block-services-page"]);
  assert.deepEqual(publicWebsitePageBlocks(value, "/contact").map((block) => block.id), ["block-contact-page"]);
  assert.equal(publicWebsitePageBlocks(value, "/")[0].type, "hero");
  assert.ok(!publicWebsitePageBlocks(value, "/").some((block) => block.type === "contact"));
});

test("each supported public page resolves only its own block composition", () => {
  const value = pageResolutionDocument();
  assert.ok(value);
  const expected = new Map([
    ["/", ["block-home-hero", "block-home-services", "block-home-projects-preview", "block-home-process-preview", "block-home-content", "block-home-final-cta"]],
    ["/services", ["block-services-page"]], ["/projects", ["block-projects-page"]], ["/process", ["block-process-page"]], ["/faq", []], ["/contact", ["block-contact-page"]],
  ]);
  for (const [path, ids] of expected) assert.deepEqual(publicWebsitePageBlocks(value, path).map((block) => block.id), ids, path);
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

test("preview and live supply the same verified service-card boundary", async () => {
  const [previewPage, preview, root, child] = await Promise.all([
    source("app/dashboard/website-ai/page.tsx"), source("app/dashboard/components/WebsitePreview.tsx"),
    source("app/business/[slug]/page.tsx"), source("app/business/[slug]/[...path]/page.tsx"),
  ]);
  assert.match(previewPage, /serviceItems=\{verifiedServices\.map/);
  assert.match(preview, /serviceItems=\{serviceItems\}/);
  assert.match(root, /serviceItems=\{publicServices\(snapshot\)\.map/);
  assert.match(child, /serviceItems=\{publicServices\(loaded\.snapshot\)\.map/);
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
  assert.equal(safeWebsiteBlockText("I run a small interior design business."), "");
  assert.equal(safeWebsiteBlockText("The website should showcase projects and generate enquiries."), "");
  assert.equal(safeWebsiteBlockText("Our team of award-winning designers has 20 years of experience."), "");
  const snapshot = buildPublishedBusinessSnapshot(preview, {}, document());
  assert.ok(snapshot.siteDocument);
});

test("Home never promotes Contact copy into its hero and keeps full Contact content on the Contact page", () => {
  const value = pageResolutionDocument();
  assert.ok(value);
  const contactHero = validateWebsiteSiteDocument({ ...value, pages: value.pages.map((page) => page.path === "/" ? { ...page, blocks: page.blocks.map((block) => block.type === "hero" ? { ...block, headline: "Contact us" } : block) } : page) });
  assert.ok(contactHero);
  const home = publicWebsitePageBlocks(contactHero, "/");
  assert.equal(home[0].type, "hero");
  assert.equal(home[0].headline, contactHero.branding.name);
  assert.ok(!home.some((block) => block.id === "block-contact-page" || block.type === "contact"));
  assert.deepEqual(publicWebsitePageBlocks(contactHero, "/contact").map((block) => block.id), ["block-contact-page"]);
});
