import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildWebsitePublicationSnapshot,
  normalizeWebsiteSlug,
  validatePublicationMutationBody,
  validateWebsiteAiOutput,
  validateWebsiteEdits,
  validateWebsitePublicationSnapshot,
  validateWebsiteSlug,
} from "../../app/lib/website-publication.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const output = Object.fromEntries([
  "websiteOverview", "websiteGoal", "recommendedPages", "siteStructure",
  "websiteFeatures", "designRecommendations", "colourScheme", "typography",
  "recommendedTechStack", "seoRecommendations",
].map((key) => [key, `${key} value`]));
const edits = {
  companyName: "Edited Business", heroHeadline: "A better headline", heroDescription: "Clear hero copy",
  aboutText: "About the company", servicesText: "Our services", phone: "+91 12345 67890",
  email: "hello@example.com", address: "Mumbai", whatsapp: "+91 12345 67890",
  primaryCtaLabel: "Book now", primaryCtaLink: "/contact", template: "Modern",
};

test("strict Website AI output accepts only bounded text fields", () => {
  assert.ok(validateWebsiteAiOutput(output));
  assert.equal(validateWebsiteAiOutput({ ...output, websiteGoal: undefined }), null);
  assert.equal(validateWebsiteAiOutput({ ...output, websiteGoal: "x".repeat(4_001) }), null);
  assert.equal(validateWebsiteAiOutput({ ...output, extra: {} }), null);
  assert.equal(validateWebsiteAiOutput({ ...output, websiteGoal: '<script src="x"></script>' }), null);
  assert.equal(validateWebsiteAiOutput({ ...output, websiteGoal: "javascript:alert(1)" }), null);
});

test("publication snapshot is exact and template allowlisted", () => {
  const snapshot = buildWebsitePublicationSnapshot({ companyName: "Example", industry: "Retail", websiteGoal: "Leads", websiteRequirements: "Simple", template: "Modern", websiteOutput: output, websiteEdits: edits });
  assert.ok(snapshot);
  assert.deepEqual(validateWebsitePublicationSnapshot(snapshot), snapshot);
  assert.equal(buildWebsitePublicationSnapshot({ companyName: "Example", industry: "Retail", websiteGoal: "Leads", websiteRequirements: "Simple", template: "Injected", websiteOutput: output }), null);
  assert.equal(validateWebsitePublicationSnapshot({ ...snapshot, ownerUid: "private" }), null);
});

test("structured website edits allow safe text and reject executable content or untrusted templates", () => {
  assert.deepEqual(validateWebsiteEdits(edits), edits);
  assert.equal(validateWebsiteEdits({ ...edits, heroHeadline: "<script>alert(1)</script>" }), null);
  assert.equal(validateWebsiteEdits({ ...edits, primaryCtaLink: "javascript:alert(1)" }), null);
  assert.equal(validateWebsiteEdits({ ...edits, template: "Injected" }), null);
  assert.equal(validateWebsiteEdits({ ...edits, customScript: "alert(1)" }), null);
});

test("website slug normalization and validation are safe", () => {
  assert.equal(normalizeWebsiteSlug("  My  Business!!! "), "my-business");
  assert.equal(validateWebsiteSlug("my-business"), "my-business");
  assert.equal(validateWebsiteSlug("My-Business"), "my-business");
  assert.equal(validateWebsiteSlug("api"), null);
  assert.equal(validateWebsiteSlug("-bad"), null);
  assert.equal(validateWebsiteSlug("x".repeat(64)), null);
});

test("publication mutation bodies reject browser snapshots and client ownership", () => {
  assert.deepEqual(validatePublicationMutationBody({ projectId: "p", slug: "my-site", template: "Modern" }, "publish"), { projectId: "p", slug: "my-site", template: "Modern" });
  assert.equal(validatePublicationMutationBody({ projectId: "p", slug: "my-site", template: "Modern", snapshot: output }, "publish"), null);
  assert.equal(validatePublicationMutationBody({ projectId: "p", slug: "my-site", template: "Modern", ownerUid: "attacker" }, "publish"), null);
});

test("publication route uses server identity, transactions, locks, immutable versions and bounded bodies", async () => {
  const route = await source("app/api/website-publications/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, uid\)/);
  assert.match(route, /MAX_BODY_BYTES = 16 \* 1024/);
  assert.match(route, /readLimitedJson/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /transaction\.insert\(websitePublicationVersions\)/);
  assert.match(route, /eq\(projectOutputs\.userId, authorized\.uid\)/);
  assert.doesNotMatch(route, /body\.(?:ownerUid|userId|snapshot)/);
});

test("public renderer reads only active immutable snapshots and renders with React", async () => {
  const page = await source("app/published-sites/[slug]/page.tsx");
  assert.match(page, /eq\(publishedWebsites\.status, "active"\)/);
  assert.match(page, /websitePublicationVersions\.snapshot/);
  assert.match(page, /validateWebsitePublicationSnapshot/);
  assert.match(page, /WebsitePreview/);
  assert.doesNotMatch(page, /ownerUid|userId|projectMemory|dangerouslySetInnerHTML|eval\(/);
});

test("migration enforces unique slug/project and append-only version identity", async () => {
  const migration = await source("drizzle/0012_add-website-publications.sql");
  assert.match(migration, /published_websites_slug_unique/);
  assert.match(migration, /published_websites_project_unique/);
  assert.match(migration, /website_publication_versions_site_version_unique/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
});
