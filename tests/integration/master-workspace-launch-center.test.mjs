import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildLaunchCenterView,
  deriveLaunchCenterNextStep,
  deriveLaunchCenterSocialStatus,
} from "../../app/lib/master-workspace-launch-center.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const readySections = [
  { module: "branding", state: "Ready", output: { brandName: "BrightNest" } },
  {
    module: "website",
    state: "Ready",
    reviewState: "Approved",
    output: {
      websiteOverview: "A polished home for the business.",
      websiteGoal: "Help customers understand the offer and get in touch.",
      recommendedPages: "Home, About, Services, Contact",
    },
  },
  { module: "marketing", state: "Ready", output: { marketingStrategy: "Saved" } },
  { module: "seo", state: "Ready", output: { seoAudit: "Saved" } },
  { module: "sales", state: "Ready", output: { executiveSummary: "Saved" } },
];

test("Launch Center uses saved project state instead of inventing completion", () => {
  const view = buildLaunchCenterView({
    projectId: "project-1",
    sections: readySections,
    publication: { status: "unpublished" },
    socialConnections: [],
  });

  assert.equal(view.headline, "Your business is ready");
  assert.equal(view.websiteWorkspaceStatus, "Ready");
  assert.equal(view.websitePublicationStatus, "Not published");
  assert.equal(view.websiteGoal, "Help customers understand the offer and get in touch.");
  assert.equal(view.websitePages, "Home, About, Services, Contact");
  assert.deepEqual(view.autopilot.map((item) => item.label), [
    "Brand",
    "Website",
    "SEO",
    "Marketing",
    "Sales",
    "Social",
  ]);
  assert.deepEqual(view.autopilot.map((item) => item.status), [
    "Ready",
    "Ready",
    "Ready",
    "Ready",
    "Ready",
    "Setup required",
  ]);
});

test("missing outputs do not appear completed in Launch Center", () => {
  const view = buildLaunchCenterView({
    projectId: "project-2",
    sections: [
      { module: "branding", state: "Ready", output: { brandName: "BrightNest" } },
      { module: "website", state: "Not generated", reviewState: null, output: null },
      { module: "marketing", state: "In progress", output: null },
      { module: "seo", state: "Not generated", output: null },
      { module: "sales", state: "Not generated", output: null },
    ],
    publication: { status: "unpublished" },
    socialConnections: [],
  });

  assert.equal(view.headline, "Welcome back to your business");
  assert.equal(view.autopilot.find((item) => item.label === "Website")?.status, "Not generated");
  assert.equal(view.autopilot.find((item) => item.label === "Marketing")?.status, "In progress");
  assert.notEqual(view.autopilot.find((item) => item.label === "Website")?.status, "Ready");
});

test("recommended next step follows priority order from real saved state", () => {
  const previewFirst = deriveLaunchCenterNextStep({
    projectId: "project-3",
    sections: readySections.map((section) => section.module === "website"
      ? { ...section, reviewState: "Needs review" }
      : section),
    publication: { status: "unpublished" },
    socialConnections: [],
  });
  assert.equal(previewFirst.title, "Preview your website");

  const publishNext = deriveLaunchCenterNextStep({
    projectId: "project-3",
    sections: readySections,
    publication: { status: "unpublished" },
    socialConnections: [{ provider: "meta", status: "setup_required" }],
  });
  assert.equal(publishNext.title, "Publish your website");

  const connectSocial = deriveLaunchCenterNextStep({
    projectId: "project-3",
    sections: readySections,
    publication: { status: "active", publicUrl: "/business/brightnest" },
    socialConnections: [{ provider: "meta", status: "setup_required" }],
  });
  assert.equal(connectSocial.title, "Connect social accounts");

  const addProducts = deriveLaunchCenterNextStep({
    projectId: "project-3",
    sections: readySections,
    publication: { status: "active", publicUrl: "/business/brightnest" },
    socialConnections: [{ provider: "meta", status: "connected" }],
  });
  assert.equal(addProducts.title, "Add products/services");

  assert.equal(deriveLaunchCenterSocialStatus([{ provider: "meta", status: "connected" }]), "Connected");
  assert.equal(deriveLaunchCenterSocialStatus([{ provider: "meta", status: "needs_attention" }]), "Needs attention");
});

test("workspace keeps Launch Center on top while existing navigation stays available", async () => {
  const page = await source("app/master-workspace/page.tsx");
  assert.match(page, /Launch Center/);
  assert.match(page, /Autopilot Workspace/);
  assert.match(page, /Preview Website/);
  assert.match(page, /Publish \/ Edit Website/);
  assert.match(page, /Continue Setup with Buzypeezy/);
  assert.match(page, /View business details/);
  assert.match(page, /Business details/);
  assert.match(page, /id="advanced-tools"/);
  assert.match(page, /Preview (?:& Edit My Business|, Edit & Publish)/);
  assert.match(page, /Manage Automation/);
});
