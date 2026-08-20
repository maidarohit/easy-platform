import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

const protectedRoutes = [
  "app/api/dashboard/summary/route.ts",
  "app/api/projects/route.ts",
  "app/api/project-memory/route.ts",
  "app/api/project-outputs/route.ts",
  "app/api/user/sync/route.ts",
];

test("Dashboard summary is scoped solely to the verified UID", async () => {
  const contents = await source("app/api/dashboard/summary/route.ts");
  assert.match(contents, /userId = \(await verifyFirebaseIdToken\(request\)\)\.uid/);
  assert.match(contents, /eq\(aiUsage\.userId, userId\)/);
  assert.match(contents, /eq\(aiManagerJobs\.userId, userId\)/);
  assert.match(contents, /inArray\(aiManagerJobs\.status, \["pending", "processing"\]\)/);
  assert.doesNotMatch(contents, /searchParams|request\.json/);
});

for (const path of protectedRoutes) {
  test(`${path} requires a verified Firebase token`, async () => {
    const contents = await source(path);
    assert.ok(contents.includes("verifyFirebaseIdToken"));
    assert.match(contents, /status:\s*401/);
    assert.match(contents, /\.uid/);
  });
}

test("Projects scope every operation to the verified UID", async () => {
  const contents = await source("app/api/projects/route.ts");
  assert.doesNotMatch(contents, /const userId = (?:searchParams|typeof body\.userId)/);
  assert.match(contents, /eq\(projects\.userId, userId\)/);
  assert.match(
    contents,
    /\.delete\(projects\)[\s\S]*and\(eq\(projects\.id, id\), eq\(projects\.userId, userId\)\)/
  );
  assert.match(
    contents,
    /and\(eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)\)/
  );
});

for (const [label, path] of [
  ["Project Memory", "app/api/project-memory/route.ts"],
  ["Project Outputs", "app/api/project-outputs/route.ts"],
]) {
  test(`${label} allows only projects owned by the verified UID`, async () => {
    const contents = await source(path);
    assert.match(contents, /from\(projects\)/);
    assert.match(
      contents,
      /and\(eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)\)/
    );
    assert.match(contents, /Project not found/);
    assert.doesNotMatch(contents, /const userId = (?:searchParams|asText\(body\.userId\))/);
  });
}

test("User sync uses token identity and ignores client identity", async () => {
  const contents = await source("app/api/user/sync/route.ts");
  assert.match(contents, /id = verifiedToken\.uid/);
  assert.match(contents, /verifiedToken\.email/);
  assert.doesNotMatch(contents, /req\.json\(\)/);
  assert.doesNotMatch(contents, /body\.(?:id|email)/);
});

test("all private-data frontend callers attach Firebase authentication", async () => {
  const paths = [
    "app/ai-manager/page.tsx",
    "app/analytics-ai/page.tsx",
    "app/branding-ai/page.tsx",
    "app/branding-ai/projects/page.tsx",
    "app/dashboard/page.tsx",
    "app/dashboard/website-ai/page.tsx",
    "app/dashboard/website-ai/projects/page.tsx",
    "app/hooks/useProjectMemory.ts",
    "app/login/page.tsx",
    "app/marketing-ai/page.tsx",
    "app/marketing-ai/projects/page.tsx",
    "app/onboarding/page.tsx",
    "app/sales-ai/page.tsx",
    "app/seo-ai/page.tsx",
    "app/signup/page.tsx",
    "app/uiux-ai/page.tsx",
  ];

  for (const path of paths) {
    const contents = await source(path);
    assert.ok(contents.includes("authenticatedFetch"), `${path} is missing authenticatedFetch`);
    assert.doesNotMatch(
      contents,
      /\bfetch\(\s*(["'`])\/api\/(?:projects|project-memory|project-outputs|user\/sync)/,
      `${path} still has an unauthenticated private-data request`
    );
  }
});
