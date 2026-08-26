import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { customerProjectAction } from "../../app/lib/customer-navigation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer-first project actions open intake only when context is absent and otherwise open My Business", () => {
  assert.deepEqual(customerProjectAction({ id: "project-new" }), {
    label: "Tell us about your business", href: "/onboarding?projectId=project-new",
  });
  assert.deepEqual(customerProjectAction({ id: "project-ready", companyName: "BrightReach" }), {
    label: "Open My Business", href: "/master-workspace?projectId=project-ready",
  });
});

test("primary sidebar is customer-first while specialists remain intentionally available under Advanced Tools", async () => {
  const sidebar = await source("app/dashboard/components/Sidebar.tsx");
  const primary = sidebar.slice(sidebar.indexOf("const PRIMARY_ITEMS"), sidebar.indexOf("const ADVANCED_ITEMS"));
  for (const label of ["Dashboard", "My Business", "Preview", "Automation", "Settings"]) assert.match(primary, new RegExp(`label: "${label}"`));
  assert.doesNotMatch(primary, /AI Manager|Branding|Website|Marketing|SEO|UI\/UX|Sales|Analytics/);
  for (const route of ["/ai-manager", "/branding-ai", "/dashboard/website-ai", "/marketing-ai", "/seo-ai", "/uiux-ai", "/sales-ai", "/analytics-ai", "/dashboard/creative-ai"]) assert.match(sidebar, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(sidebar, /<details open=\{advancedActive\}/);
  assert.match(sidebar, /aria-label="Advanced Tools"/);
});

test("project context and published-business navigation are preserved across the shared sidebar", async () => {
  const sidebar = await source("app/dashboard/components/Sidebar.tsx");
  assert.match(sidebar, /params\.set\("projectId", projectId\)/);
  assert.match(sidebar, /\/api\/business-publications\?projectId=/);
  assert.match(sidebar, /publication\.status === "active"/);
  assert.match(sidebar, /View Live Business/);
  assert.match(sidebar, /w-20[\s\S]*sm:w-64/);
  assert.match(sidebar, /aria-label=\{item\.label\}/);
});

test("Dashboard navigation cannot restart Build My Business and keeps advanced tools secondary", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(dashboard, /customerProjectAction\(project\)/);
  for (const label of ["Tell us about your business", "Build My Business", "Review My Business", "Publish My Business", "View Live Business"]) assert.match(`${dashboard}\n${await source("app/lib/customer-navigation.ts")}`, new RegExp(label));
  assert.match(dashboard, /authenticatedFetch\(`\/api\/business-preview\?projectId=/);
  assert.match(dashboard, /authenticatedFetch\(`\/api\/business-publications\?projectId=/);
  assert.match(dashboard, /Open Advanced Tools/);
  assert.match(dashboard, /\/master-workspace\?projectId=.*#advanced-tools/);
  assert.doesNotMatch(dashboard, /router\.push\(`\/easy-mode|\/api\/business-build|\/api\/easy-mode/);
});

test("My Business exposes preview, publishing, live-business and automation actions without generation", async () => {
  const workspace = await source("app/master-workspace/page.tsx");
  assert.match(workspace, /Preview & Edit My Business/);
  assert.match(workspace, /Preview, Edit & Publish/);
  assert.match(workspace, /Manage Automation/);
  assert.match(workspace, /View Live Business/);
  assert.match(workspace, /id="advanced-tools"/);
  assert.doesNotMatch(workspace, /\/api\/business-build|\/api\/easy-mode|OpenAI|N8N_/);
});

test("navigation changes do not mutate outputs or bypass protected-route authentication", async () => {
  const [sidebar, workspaceApi, previewApi] = await Promise.all([
    source("app/dashboard/components/Sidebar.tsx"),
    source("app/api/master-workspace/route.ts"),
    source("app/api/business-preview/route.ts"),
  ]);
  assert.doesNotMatch(sidebar, /method:\s*"POST"|method:\s*"PUT"|method:\s*"DELETE"|projectOutputs|OpenAI|n8n/i);
  assert.match(workspaceApi, /verifyFirebaseIdToken\(request\)/);
  assert.match(previewApi, /verifyFirebaseIdToken\(request\)/);
});
