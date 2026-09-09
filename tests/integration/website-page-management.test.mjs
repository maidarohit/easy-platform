import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeWebsiteDraftForPersistence } from "../../app/lib/website-intelligence-connection.ts";
import { visibleWebsiteNavigation } from "../../app/lib/website-site-presentation.ts";
import {
  adaptLegacyWebsiteToSiteDocument,
  addWebsitePage,
  removeWebsitePage,
  renameWebsitePage,
  reorderWebsitePages,
  restoreWebsitePage,
  setWebsitePageNavigationVisibility,
} from "../../app/lib/website-site-document.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const output = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
const legacy = { companyName: "Example", template: "Modern", websiteOutput: output };
const documentWithAbout = () => addWebsitePage(adaptLegacyWebsiteToSiteDocument(legacy), { title: "About", path: "/about", type: "about" });

test("customers can add a page with stable page and navigation IDs", () => {
  const document = documentWithAbout();
  assert.ok(document);
  const about = document.pages.find((page) => page.path === "/about");
  assert.equal(about.id, "page-about");
  assert.equal(document.navigation.items.find((item) => item.pageId === about.id)?.id, "nav-about");
});

test("rename and path update preserve the page ID and update canonical navigation", () => {
  const document = documentWithAbout();
  const about = document.pages.find((page) => page.path === "/about");
  const renamed = renameWebsitePage(document, about.id, { title: "Our Studio", path: "/our-studio" });
  assert.equal(renamed.pages.find((page) => page.id === about.id)?.path, "/our-studio");
  assert.equal(renamed.pages.find((page) => page.id === about.id)?.seo.canonicalPath, "/our-studio");
  assert.equal(renamed.navigation.items.find((item) => item.pageId === about.id)?.label, "Our Studio");
});

test("page reorder updates page and navigation order without changing IDs", () => {
  const document = documentWithAbout();
  const ids = document.pages.map((page) => page.id);
  const reordered = reorderWebsitePages(document, [...ids].reverse());
  assert.deepEqual([...reordered.pages].sort((a, b) => a.order - b.order).map((page) => page.id), [...ids].reverse());
  assert.deepEqual([...reordered.navigation.items].sort((a, b) => a.order - b.order).map((item) => item.pageId), [...ids].reverse());
});

test("hide and show update navigation while keeping the page previewable", () => {
  const document = documentWithAbout();
  const about = document.pages.find((page) => page.path === "/about");
  const hidden = setWebsitePageNavigationVisibility(document, about.id, false);
  assert.equal(hidden.pages.find((page) => page.id === about.id)?.visibility, "visible");
  assert.deepEqual(visibleWebsiteNavigation(hidden).map((item) => item.pageId), ["page-home"]);
  const shown = setWebsitePageNavigationVisibility(hidden, about.id, true);
  assert.ok(visibleWebsiteNavigation(shown).some((item) => item.pageId === about.id));
});

test("Home is protected and duplicate or reserved paths are rejected", () => {
  const document = documentWithAbout();
  assert.equal(removeWebsitePage(document, "page-home"), null);
  assert.equal(renameWebsitePage(document, "page-home", { title: "Home", path: "/welcome" }), null);
  assert.equal(addWebsitePage(document, { title: "Duplicate", path: "/about", type: "custom" }), null);
  assert.equal(addWebsitePage(document, { title: "Private", path: "/api/private", type: "custom" }), null);
});

test("soft-remove retains the page and stable ID and supports a hidden-navigation restore", () => {
  const document = documentWithAbout();
  const about = document.pages.find((page) => page.path === "/about");
  const removed = removeWebsitePage(document, about.id);
  assert.equal(removed.pages.find((page) => page.id === about.id)?.visibility, "removed");
  assert.ok(!visibleWebsiteNavigation(removed).some((item) => item.pageId === about.id));
  const restored = restoreWebsitePage(removed, about.id);
  assert.equal(restored.pages.find((page) => page.id === about.id)?.visibility, "visible");
  assert.ok(!visibleWebsiteNavigation(restored).some((item) => item.pageId === about.id));
});

test("draft preview navigation switches selected paths without publication calls", async () => {
  const page = await source("app/dashboard/website-ai/page.tsx");
  const renderer = await source("app/dashboard/components/WebsiteSiteRenderer.tsx");
  assert.match(page, /pagePath=\{selectedPagePath\}[\s\S]*onPageNavigate=\{setSelectedPagePath\}/);
  assert.match(renderer, /event\.preventDefault\(\); onNavigate\(href\)/);
  assert.doesNotMatch(renderer, /website-publications|business-publications|fetch\(/);
});

test("Page Manager actions keep readable interactive, disabled, and destructive states", async () => {
  const manager = await source("app/dashboard/components/WebsitePageManager.tsx");
  assert.match(manager, /ACTION_BUTTON = .*bg-slate-800.*text-white.*hover:bg-slate-700.*focus-visible:ring-2.*disabled:bg-slate-900.*disabled:text-slate-500/);
  assert.match(manager, /SAVE_BUTTON = .*bg-cyan-950.*text-cyan-50.*hover:bg-cyan-900.*focus-visible:ring-2.*disabled:text-slate-500/);
  assert.match(manager, /REMOVE_BUTTON = .*border-red-400.*bg-red-950.*text-red-100.*hover:bg-red-900.*focus-visible:ring-red-300.*disabled:text-slate-500/);
  for (const label of ["Preview", "Move up", "Move down", "Hide from navigation", "Show in navigation", "Remove", "Restore hidden", "Save name/path"]) assert.ok(manager.includes(label), label);
});

test("schema-v1 remains on the existing renderer until pages are explicitly set up", async () => {
  const page = await source("app/dashboard/website-ai/page.tsx");
  const preview = await source("app/dashboard/components/WebsitePreview.tsx");
  assert.match(page, /siteDocument \? <WebsitePageManager[\s\S]*Set up pages/);
  assert.match(preview, /if \(siteDocument\)[\s\S]*switch \(websiteStyle\)/);
  assert.doesNotMatch(page, /setSiteDocument\(adaptLegacyWebsiteToSiteDocument/);
});

test("the same owned Website output row preserves a validated page document", async () => {
  const siteDocument = documentWithAbout();
  const normalized = normalizeWebsiteDraftForPersistence({ project: { name: "Example", companyName: "Example", industry: "Design", brandStyle: "Modern" }, website: { ...output, siteDocument } });
  assert.deepEqual(normalized.siteDocument, siteDocument);
  const route = await source("app/api/project-outputs/route.ts");
  assert.match(route, /eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, userId\)[\s\S]*eq\(projectOutputs\.module, moduleName\)/);
  assert.match(route, /update\(projectOutputs\)[\s\S]*eq\(projectOutputs\.id, existingOutput\.id\)/);
  const publicationRoute = await source("app/api/website-publications/route.ts");
  assert.match(publicationRoute, /siteDocument: _siteDocument[\s\S]*validateWebsiteAiOutput\(legacyOutput\)/);
  assert.match(publicationRoute, /websiteOutput: storedLegacyWebsiteOutput\(outputResult\)/);
});
