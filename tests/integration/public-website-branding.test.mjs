import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("public business footer keeps customer copyright and adds canonical attribution without private data", async () => {
  const page = await source("app/business/[slug]/page.tsx");
  const attribution = await source("app/components/PoweredByBuzypeezy.tsx");
  assert.match(page, /© \{new Date\(\)\.getUTCFullYear\(\)\} \{snapshot\.business\.name\}/);
  assert.match(page, /<PoweredByBuzypeezy/);
  assert.match(attribution, /Powered by/);
  assert.match(attribution, /https:\/\/buzypeezy\.ai\//);
  assert.doesNotMatch(attribution, /projectId|userId|ownerUid/);
});

test("the shared renderer gives every public template the same subtle attribution", async () => {
  const preview = await source("app/dashboard/components/WebsitePreview.tsx");
  for (const template of ["Modern", "Luxury", "Corporate", "Creative", "Minimal", "Dark"]) {
    assert.match(preview, new RegExp(`case "${template}"`));
  }
  assert.match(preview, /\{selectedTemplate\}[\s\S]*<PoweredByBuzypeezy/);
  assert.match(preview, /text-xs/);
});

test("Master Workspace reuses publication status and URL for clear owner-facing state", async () => {
  const workspace = await source("app/master-workspace/page.tsx");
  assert.match(workspace, /publication\.status === "active"/);
  assert.match(workspace, /publication\.publicUrl/);
  assert.match(workspace, />View Live Website<\/Link>/);
  assert.match(workspace, /\? "Published" : "Not Published"/);
  assert.doesNotMatch(workspace, /setPublication\([^)]*projectId/);
});
