import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Business Preview maps the saved secondary image into the rendered work slot", async () => {
  const page = await source("app/business-preview/page.tsx");
  assert.match(page, /hero: uploadedSrcFromRecord\(website, "hero"\)/);
  assert.match(page, /work: uploadedSrcFromRecord\(website, "showcase"\)/);
  assert.match(page, /const showcaseVisuals = media\.work/);
  assert.match(page, /showcaseVisuals\.map/);
});

test("secondary uploads persist the same field consumed after refresh and remain owner scoped", async () => {
  const uploadRoute = await source("app/api/business-preview/images/route.ts");
  const previewRoute = await source("app/api/business-preview/route.ts");
  const edits = await source("app/lib/business-preview-edits.ts");

  assert.match(uploadRoute, /secondaryImage: result\.overrides\.secondaryImage/);
  assert.match(uploadRoute, /eq\(projects\.id, projectId\)[\s\S]*eq\(projects\.userId, userId\)/);
  assert.match(uploadRoute, /eq\(projectPreviewCustomizations\.projectId, projectId\)[\s\S]*eq\(projectPreviewCustomizations\.userId, userId\)/);
  assert.match(previewRoute, /applyPreviewOverrides\(originalPreview, overrides\)/);
  assert.match(edits, /if \(overrides\.secondaryImage\) next\.website\.secondaryImage = overrides\.secondaryImage/);
});
