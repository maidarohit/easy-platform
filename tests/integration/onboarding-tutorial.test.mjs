import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("first-time onboarding shows the shared tutorial before the existing intake", async () => {
  const [tutorial, onboarding] = await Promise.all([
    source("app/components/ProductTutorial.tsx"), source("app/onboarding/page.tsx"),
  ]);
  assert.match(tutorial, /See how Buzypeezy works/);
  assert.match(tutorial, /From your idea to a complete digital business/);
  assert.match(onboarding, /!hasVision && !tutorialComplete/);
  assert.match(onboarding, /mode="entry"/);
  assert.match(onboarding, /useBrowserSpeech/);
});

test("skip and Start My Business enter the existing intake without navigation or reset", async () => {
  const [tutorial, onboarding] = await Promise.all([
    source("app/components/ProductTutorial.tsx"), source("app/onboarding/page.tsx"),
  ]);
  assert.match(tutorial, /Skip for now/);
  assert.match(tutorial, /Start My Business/);
  assert.match(tutorial, /onComplete/);
  assert.match(onboarding, /setTutorialComplete\(true\)/);
  assert.doesNotMatch(tutorial, /router\.|location\.|business-dna|saveDnaPatch|sessionStorage/);
});

test("Help Tutorial replays the same component across customer workspaces", async () => {
  const [tutorial, easyMode, workspace, onboarding] = await Promise.all([
    source("app/components/ProductTutorial.tsx"), source("app/easy-mode/page.tsx"),
    source("app/master-workspace/page.tsx"), source("app/onboarding/page.tsx"),
  ]);
  assert.match(tutorial, /Help \/ Tutorial/);
  assert.match(easyMode, /<ProductTutorial area="easy-mode"/);
  assert.match(workspace, /<ProductTutorial area="master-workspace"/);
  assert.match(onboarding, /<ProductTutorial area="onboarding"/);
});

test("returning users bypass the entry tutorial through a tutorial-only preference", async () => {
  const tutorial = await source("app/components/ProductTutorial.tsx");
  assert.match(tutorial, /buzypeezy:tutorial-viewed:getting-started/);
  assert.match(tutorial, /tutorialWasCompleted\(\)/);
  assert.match(tutorial, /onComplete\?\.\(\)/);
  assert.doesNotMatch(tutorial, /projectId|BusinessDna|projectMemory/);
});

test("missing local video has a polished fallback and captions hook", async () => {
  const tutorial = await source("app/components/ProductTutorial.tsx");
  assert.match(tutorial, /\/videos\/buzypeezy-getting-started\.mp4/);
  assert.match(tutorial, /\/videos\/buzypeezy-getting-started\.vtt/);
  assert.match(tutorial, /onError=\{\(\) => setMissing\(true\)\}/);
  assert.match(tutorial, /The video is being prepared/);
  await assert.rejects(() => access(new URL("../../public/videos/buzypeezy-getting-started.mp4", import.meta.url)));
});

test("tutorial interactions contain no provider or generation endpoint", async () => {
  const tutorial = await source("app/components/ProductTutorial.tsx");
  assert.doesNotMatch(tutorial, /authenticatedFetch|\bfetch\s*\(|OPENAI|N8N_|execute-next|business-build|\/api\//i);
  assert.doesNotMatch(tutorial, /branding|website-ai|marketing-ai|seo-ai|uiux-ai|sales-ai|analytics-ai/i);
});
