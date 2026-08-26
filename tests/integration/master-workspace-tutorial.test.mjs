import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Master Workspace Help Tutorial is explicitly the shared ProductTutorial", async () => {
  const [page, productTutorial] = await Promise.all([
    source("app/master-workspace/page.tsx"), source("app/components/ProductTutorial.tsx"),
  ]);
  assert.match(page, /import ProductTutorial from "@\/app\/components\/ProductTutorial"/);
  assert.match(page, /<ProductTutorial area="master-workspace" \/>/);
  assert.match(productTutorial, />Help \/ Tutorial<\/button>/);
  assert.match(productTutorial, /\/videos\/buzypeezy-getting-started\.mp4/);
  assert.doesNotMatch(productTutorial, /Master Workspace Guide|Step \{step \+ 1\} of/);
});

test("the retained five-step guide has a separate Workspace Guide action", async () => {
  const [page, guide] = await Promise.all([
    source("app/master-workspace/page.tsx"), source("app/components/WorkspaceGuide.tsx"),
  ]);
  assert.match(page, /import WorkspaceGuide/);
  assert.match(page, /<WorkspaceGuide \/>/);
  assert.match(guide, />Workspace Guide<\/button>/);
  assert.match(guide, /Master Workspace Guide/);
  assert.match(guide, /Step \{step \+ 1\} of \{WORKSPACE_STEPS\.length\}/);
  assert.doesNotMatch(guide, /Help \/ Tutorial/);
});

test("missing MP4 remains a branded, provider-free fallback", async () => {
  const tutorial = await source("app/components/ProductTutorial.tsx");
  assert.match(tutorial, /onError=\{\(\) => setMissing\(true\)\}/);
  assert.match(tutorial, /The video is being prepared/);
  await assert.rejects(() => access(new URL("../../public/videos/buzypeezy-getting-started.mp4", import.meta.url)));
  const guide = await source("app/components/WorkspaceGuide.tsx");
  assert.doesNotMatch(`${tutorial}\n${guide}`, /authenticatedFetch|\bfetch\s*\(|\/api\/|OPENAI|N8N_|execute-next/i);
});
