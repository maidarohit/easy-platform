import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("logged-in customers get an obvious mobile-first new business action", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(dashboard, /Start something new/i);
  assert.match(dashboard, /\+ Start a New Business/);
  assert.match(dashboard, /Tell us what you do or what you want to build\. You don&apos;t need a business plan\./);
  assert.match(dashboard, /w-full[\s\S]*lg:w-auto/);
});

test("new business routing never carries the currently selected projectId", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(dashboard, /router\.push\("\/onboarding"\)/);
  assert.doesNotMatch(dashboard, /Start a New Business[\s\S]{0,300}projectId/);
});

test("new intake creates a create-only UUID project and cannot overwrite by name", async () => {
  const [onboarding, projects, validation] = await Promise.all([
    source("app/onboarding/page.tsx"),
    source("app/api/projects/route.ts"),
    source("app/lib/project-request-validation.ts"),
  ]);
  assert.match(onboarding, /id = crypto\.randomUUID\(\)/);
  assert.match(onboarding, /creationIntent: "new-business"/);
  assert.match(projects, /createOnly = body\.creationIntent === "new-business"/);
  assert.match(projects, /createOnly \? \[\] : await db/);
  assert.match(validation, /value\.creationIntent !== "new-business"/);
});

test("starting a new intake makes no AI, n8n, build, or project mutation from Dashboard", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.doesNotMatch(dashboard, /\/api\/(?:business-build|easy-mode|business-dna\/analyze)|OpenAI|N8N_|creationIntent|method:\s*"POST"/i);
});

test("existing businesses are separated and Continue preserves their own project route", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(dashboard, /Your Businesses/);
  assert.match(dashboard, /Continue Business/);
  assert.match(dashboard, /continueBusiness\(project\)/);
  assert.match(dashboard, /projectActions\[project\.id\]/);
  assert.match(dashboard, /encodeURIComponent\(project\.id\)/);
  assert.match(dashboard, /Open Advanced Tools/);
});

test("homepage signup and newly verified accounts reach the same safe intake", async () => {
  const [homepage, verification] = await Promise.all([
    source("app/page.tsx"), source("app/verify-email/page.tsx"),
  ]);
  assert.match(homepage, /href="\/signup"[\s\S]*Start Building/);
  assert.match(verification, /projectsData\.projects\?\.length === 0 \? "\/onboarding" : "\/dashboard"/);
  assert.doesNotMatch(verification, /\/api\/(?:business-build|easy-mode|business-dna\/analyze)|OpenAI|N8N_/i);
});
