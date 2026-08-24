import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Website publication lifecycle remains explicit and does not auto-publish on generation", async () => {
  const page = await source("app/dashboard/website-ai/page.tsx");
  assert.match(page, /Approve &(?:amp;)? Go Live/);
  assert.match(page, /Republish Changes/);
  assert.match(page, /Unpublish/);
  assert.match(page, /View Live Site/);
  assert.match(page, /Edit Website/);
  assert.match(page, /Save Changes/);
  assert.match(page, /websiteEdits/);
  assert.match(page, /Your website is ready/);
  assert.match(page, /Use my Buzypeezy website address/);
  assert.match(page, /Connect my own domain/);
  assert.match(page, /DNS verification/);
  assert.match(page, /Back to Edit/);
  const generationStart = page.indexOf("const handleGenerateBrand");
  const generationEnd = page.indexOf("const handleNewWebsite");
  assert.doesNotMatch(page.slice(generationStart, generationEnd), /website-publications/);
});

test("publication APIs preserve ownership, verified auth, entitlement and trusted DB output", async () => {
  const route = await source("app/api/website-publications/route.ts");
  assert.match(route, /checkUsageAllowance\(uid, "standardAiTasks"\)/);
  assert.match(route, /eq\(projects\.id, projectId\).*eq\(projects\.userId, uid\)/s);
  assert.match(route, /eq\(projectOutputs\.module, "website"\)/);
  assert.match(route, /status: "inactive"/);
  assert.match(route, /action: "unpublish"/);
  assert.match(route, /status: "active"/);
});
