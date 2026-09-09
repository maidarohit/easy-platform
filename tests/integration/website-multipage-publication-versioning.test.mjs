import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildMultiPageWebsitePublicationSnapshot,
  buildWebsitePublicationSnapshot,
  validateWebsitePublicationSnapshot,
} from "../../app/lib/website-publication.ts";
import { adaptLegacyWebsiteToSiteDocument, addWebsitePage } from "../../app/lib/website-site-document.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const output = Object.fromEntries([
  "websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures",
  "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations",
].map((key) => [key, `${key} value`]));
const input = { companyName: "Example", industry: "Design", websiteGoal: "Leads", websiteRequirements: "", template: "Modern", websiteOutput: output };

function multiPageSnapshot() {
  const home = adaptLegacyWebsiteToSiteDocument(input);
  const siteDocument = addWebsitePage(home, { title: "About", path: "/about", type: "about" });
  return buildMultiPageWebsitePublicationSnapshot({ ...input, siteDocument });
}

test("first schema-v2 publish stores one complete atomic version-one snapshot", async () => {
  const route = await source("app/api/website-publications/route.ts");
  const snapshot = multiPageSnapshot();
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.siteDocument.pages.length, 2);
  assert.deepEqual(validateWebsitePublicationSnapshot(snapshot), snapshot);
  assert.match(route, /transaction\.insert\(publishedWebsites\)[\s\S]*currentVersion: 1[\s\S]*transaction\.insert\(websitePublicationVersions\)[\s\S]*versionNumber: 1/);
  assert.match(route, /transaction\.select\(\{ id: publishedWebsites\.id \}\)[\s\S]*eq\(publishedWebsites\.projectId, parsed\.body\.projectId\)[\s\S]*PUBLICATION_EXISTS/);
});

test("schema-v2 republish appends a version and advances the same owned publication", async () => {
  const route = await source("app/api/website-publications/route.ts");
  assert.match(route, /const nextVersion = current\.currentVersion \+ 1/);
  assert.match(route, /publishedWebsiteId: current\.id, versionNumber: nextVersion, action: "republish", snapshot/);
  assert.match(route, /update\(publishedWebsites\)[\s\S]*eq\(publishedWebsites\.id, current\.id\)[\s\S]*eq\(publishedWebsites\.projectId, parsed\.body\.projectId\)[\s\S]*eq\(publishedWebsites\.ownerUid, authorized\.uid\)/);
  assert.doesNotMatch(route.slice(route.indexOf("export async function PATCH"), route.indexOf("export async function DELETE")), /insert\(publishedWebsites\)/);
});

test("draft changes remain separate from the current live immutable version", async () => {
  const [route, loader] = await Promise.all([
    source("app/api/website-publications/route.ts"),
    source("app/lib/public-website-publication.ts"),
  ]);
  assert.match(route, /eq\(projectOutputs\.module, "website"\)[\s\S]*orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\), desc\(projectOutputs\.id\)\)/);
  assert.match(loader, /eq\(websitePublicationVersions\.versionNumber, publishedWebsites\.currentVersion\)/);
  assert.doesNotMatch(loader, /projectOutputs|projectPreviewCustomizations/);
});

test("version history remains append-only and unpublish carries forward the current snapshot", async () => {
  const [route, migration] = await Promise.all([
    source("app/api/website-publications/route.ts"),
    source("drizzle/0012_add-website-publications.sql"),
  ]);
  assert.match(route, /versionNumber, current\.currentVersion[\s\S]*versionNumber: nextVersion, action: "unpublish", snapshot: liveVersion\.snapshot/);
  assert.doesNotMatch(route, /(?:update|delete)\(websitePublicationVersions\)/);
  assert.match(migration, /website_publication_versions_site_version_unique/);
  assert.match(migration, /ON DELETE restrict/);
});

test("schema-v1 publication remains valid without migration", () => {
  const legacy = buildWebsitePublicationSnapshot(input);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal("siteDocument" in legacy, false);
  assert.deepEqual(validateWebsitePublicationSnapshot(legacy), legacy);
});

test("publication mutation remains owner/project isolated and preserves slug", async () => {
  const route = await source("app/api/website-publications/route.ts");
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("export async function DELETE"));
  assert.match(patch, /eq\(publishedWebsites\.projectId, parsed\.body\.projectId\), eq\(publishedWebsites\.ownerUid, authorized\.uid\)/);
  assert.match(patch, /snapshotFor\(authorized\.project, current\.template/);
  assert.doesNotMatch(patch, /\.set\(\{[^}]*slug|parsed\.body\.slug|body\.(?:ownerUid|userId|snapshot)/);
});
