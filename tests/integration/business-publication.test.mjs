import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPublishedBusinessSnapshot, businessPreviewRevision, normalizeBusinessSlug,
  validateBusinessSlug, validatePublishedBusinessSnapshot,
} from "../../app/lib/business-publication.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const preview = {
  projectId: "private-project-id", business: { name: "BrightReach Digital", industry: "Marketing", goal: "Leads", description: "Agency" },
  brand: { name: "BrightReach", tagline: "Edited tagline", colours: ["#0A4D8C"], colourDirection: null, typography: null, voice: null, logoConcept: null, story: null },
  website: { heroHeadline: "Customer-edited headline", supportingText: "Support", primaryCta: "Book now", services: "Services", serviceCards: [], trust: null, about: "Value", features: null, contact: "hello@example.com" },
  marketing: null, search: { positioning: null, keywords: null, keywordTags: [], localFocus: null, title: "Approved SEO title", description: "Approved description" }, journey: null,
  approval: { approved: true, outputIds: ["private-output-id"] },
};

test("published snapshot includes current customization but excludes private identifiers and approval data", () => {
  const snapshot = buildPublishedBusinessSnapshot(preview);
  assert.equal(snapshot.website?.heroHeadline, "Customer-edited headline");
  assert.equal(snapshot.brand?.tagline, "Edited tagline");
  assert.equal("projectId" in snapshot, false);
  assert.equal("approval" in snapshot, false);
  assert.equal(validatePublishedBusinessSnapshot(snapshot)?.search?.title, "Approved SEO title");
});

test("public slugs are deterministic, safe, reserved-aware, and revision changes track private edits", () => {
  assert.equal(normalizeBusinessSlug(" BrightReach Digital! "), "brightreach-digital");
  assert.equal(validateBusinessSlug("brightreach-digital"), "brightreach-digital");
  assert.equal(validateBusinessSlug("../secret"), null);
  assert.notEqual(businessPreviewRevision(["output-1"], 1, {}), businessPreviewRevision(["output-1"], 2, { "brand.tagline": "New" }));
});

test("publication API gates on current approval, owner scopes every mutation, snapshots versions, and is idempotent", async () => {
  const route = await source("app/api/business-publications/route.ts");
  assert.match(route, /verifyFirebaseIdToken\(request\)/);
  assert.match(route, /eq\(projects\.userId, uid\)/);
  assert.match(route, /eq\(businessPublications\.userId, uid\)/);
  assert.match(route, /if \(!approved\) throw new Error\("PREVIEW_NOT_APPROVED"\)/);
  assert.match(route, /customRows\[0\]\?\.approvedAt/);
  assert.match(route, /existing\?\.status === "active" && existing\.publishedPreviewRevision === revision/);
  assert.match(route, /insert\(businessPublicationVersions\)/);
  assert.match(route, /buildPublishedBusinessSnapshot\(preview\)/);
  assert.match(route, /status: "inactive"/);
  assert.doesNotMatch(route, /update\(projectOutputs\)|update\(projectBusinessDna\)|fetch\(|OpenAI|N8N_|startAiUsage|Build My Business/i);
});

test("public business page is auth-free, active-only, snapshot-based, and exposes no internal controls", async () => {
  const page = await source("app/business/[slug]/page.tsx");
  assert.match(page, /eq\(businessPublications\.status, "active"\)/);
  assert.match(page, /businessPublicationVersions\.snapshot/);
  assert.match(page, /generateMetadata/);
  assert.match(page, /snapshot\.search\?\.title/);
  assert.doesNotMatch(page, /verifyFirebaseIdToken|projectId|Edit|Approve Preview|Master Workspace|Branding AI|Website AI|SEO AI|UIUX AI|Sales AI|JSON\.stringify/);
});

test("Preview and Master Workspace expose customer publication flow without generation paths", async () => {
  const [previewPage, workspace] = await Promise.all([source("app/business-preview/page.tsx"), source("app/master-workspace/page.tsx")]);
  assert.match(previewPage, /Publish My Business/);
  assert.match(previewPage, /View Live Business/);
  assert.match(previewPage, /Unpublish/);
  assert.match(previewPage, /Back to Business Workspace/);
  assert.match(workspace, /Not published/);
  assert.match(workspace, /Published/);
  assert.match(workspace, /Changes awaiting approval/);
  assert.match(workspace, /View Live Business/);
  assert.doesNotMatch(`${previewPage}\n${workspace}`, /\/api\/business-build|\/api\/easy-mode|OpenAI|N8N_/);
});

test("migration is dedicated, versioned, and leaves generated data untouched", async () => {
  const migration = await source("drizzle/0018_add-business-publications.sql");
  assert.match(migration, /CREATE TABLE "business_publications"/);
  assert.match(migration, /"published_preview_revision" integer NOT NULL/);
  assert.match(migration, /CREATE TABLE "business_publication_versions"/);
  assert.match(migration, /business_publications_slug_unique/);
  assert.match(migration, /business_publications_project_unique/);
  assert.doesNotMatch(migration, /project_outputs|project_business_dna|project_preview_customizations|DROP|DELETE FROM/i);
});
