import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("homepage hero clearly offers the free website preview", async () => {
  const home = await source("app/page.tsx");
  assert.match(home, /Create My Free Website Preview/);
  assert.match(home, /No payment required · 1 AI website preview free · Subscribe to publish and unlock all AI tools\./);
});

test("dashboard shows the free banner only from authoritative unpaid status", async () => {
  const dashboard = await source("app/dashboard/page.tsx");
  assert.match(dashboard, /authenticatedFetch\("\/api\/billing\/status"/);
  assert.match(dashboard, /setPaidAccess\(billingResponse\.ok \? billing\.entitlements\?\.paidAccess === true : null\)/);
  assert.match(dashboard, /paidAccess === false && currentProject/);
  assert.match(dashboard, /Free Account — 1 Website Preview Included/);
  assert.match(dashboard, /Create Free Website Preview/);
  assert.match(dashboard, /\/dashboard\/website-ai\?projectId=/);
  assert.match(dashboard, /\/billing\?plan=business/);
});

test("paid tools carry informational Business Plan badges without navigation blocking", async () => {
  const [sidebar, easyMode] = await Promise.all([source("app/dashboard/components/Sidebar.tsx"), source("app/easy-mode/page.tsx")]);
  for (const label of ["Automation", "AI Manager", "Branding", "Marketing", "SEO", "UI/UX", "Sales", "Analytics", "Creative Tools"]) {
    assert.match(sidebar, new RegExp(`label: "${label.replace("/", "\\/")}"[^\\n]*businessPlan: true`));
  }
  assert.match(sidebar, /href=\{withProject\(item\.href, projectId\)\}/);
  assert.doesNotMatch(sidebar, /disabled=\{item\.businessPlan\}/);
  assert.match(easyMode, /Build My Business[\s\S]*Business Plan/);
});
