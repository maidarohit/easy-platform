import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildWorkspaceAtmosphere,
  extractWorkspaceBrandColors,
  resolveWorkspaceAtmosphereCategory,
  selectWorkspaceAtmosphereImage,
  selectWorkspaceAtmosphereScene,
} from "../../app/lib/master-workspace-atmosphere.ts";
import { buildLaunchCenterView } from "../../app/lib/master-workspace-launch-center.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("workspace atmosphere maps industries into stable business categories", () => {
  assert.equal(resolveWorkspaceAtmosphereCategory({
    industry: "Interior design studio",
    businessDescription: "Luxury home styling and furniture curation.",
  }), "home-interiors");
  assert.equal(resolveWorkspaceAtmosphereCategory({
    industry: "Technology consulting",
    businessDescription: "Automation platform for fast-moving teams.",
  }), "technology-startup");
  assert.equal(resolveWorkspaceAtmosphereCategory({
    industry: "Wellness spa",
    businessDescription: "Skin treatments and beauty rituals.",
  }), "beauty-wellness");
});

test("workspace atmosphere falls back to the neutral business category", () => {
  assert.equal(resolveWorkspaceAtmosphereCategory({
    businessName: "Northwind",
    industry: "",
    businessDescription: "",
    brandStyle: "",
  }), "general-business");
});

test("workspace atmosphere scene selection is deterministic and rotates by day or manual offset", () => {
  const first = selectWorkspaceAtmosphereScene({
    projectId: "project-1",
    category: "technology-startup",
    dayKey: "2026-09-15",
  });
  const sameAgain = selectWorkspaceAtmosphereScene({
    projectId: "project-1",
    category: "technology-startup",
    dayKey: "2026-09-15",
  });
  const rotated = selectWorkspaceAtmosphereScene({
    projectId: "project-1",
    category: "technology-startup",
    dayKey: "2026-09-15",
    sceneOffset: 1,
  });

  assert.equal(first.id, sameAgain.id);
  assert.notEqual(first.id, rotated.id);
});

test("workspace atmosphere uses static mode when reduced motion is requested", () => {
  const model = buildWorkspaceAtmosphere({
    projectId: "project-2",
    industry: "Fitness coach",
    businessDescription: "Personal training for busy professionals.",
    dayKey: "2026-09-15",
    reducedMotion: true,
  });

  assert.equal(model.motionMode, "static");
  assert.equal(model.category, "fitness");
});

test("workspace atmosphere prefers saved uploaded business imagery before curated fallback", () => {
  const image = selectWorkspaceAtmosphereImage({
    projectId: "project-uploads",
    category: "home-interiors",
    dayKey: "2026-09-15",
    websiteOutput: {
      heroImage: "/uploads/hero.webp",
      secondaryImage: "/uploads/studio.jpg",
      nested: { gallery: ["https://firebasestorage.googleapis.com/v0/b/example/o/photo-one"] },
    },
  });

  assert.ok(image);
  assert.equal(image?.source, "uploaded");
  assert.match(image?.src || "", /^(?:\/uploads\/|https:\/\/firebasestorage\.googleapis\.com\/)/);
});

test("workspace atmosphere keeps the gradient-only fallback when no uploaded or local category image exists", () => {
  const image = selectWorkspaceAtmosphereImage({
    projectId: "project-no-images",
    category: "general-business",
    dayKey: "2026-09-15",
    websiteOutput: { siteDocument: { pages: [] } },
    brandingOutput: { note: "No media here." },
  });

  assert.equal(image, null);
});

test("workspace atmosphere can draw subtle color influence from saved branding output", () => {
  assert.deepEqual(
    extractWorkspaceBrandColors({
      colorPalette: "Forest #173D32, Gold #D8B36A, Sky #7BC8D8",
    }),
    ["#173D32", "#D8B36A", "#7BC8D8"],
  );
});

test("workspace page lazy-loads the atmosphere layer and keeps existing launch center and navigation", async () => {
  const [page, atmosphere] = await Promise.all([
    source("app/master-workspace/page.tsx"),
    source("app/master-workspace/WorkspaceAtmosphere.tsx"),
  ]);
  assert.match(page, /dynamic\(\(\) => import\("\.\/WorkspaceAtmosphere"\)/);
  assert.match(atmosphere, /Workspace appearance/);
  assert.match(atmosphere, /Atmosphere \{enabled \? "On" : "Off"\}/);
  assert.match(atmosphere, /Scene/);
  assert.match(atmosphere, /loading="lazy"/);
  assert.match(page, /Launch Center/);
  assert.match(page, /id="advanced-tools"/);
  assert.match(page, /Manage Automation/);
});

test("launch center state stays unchanged while atmosphere derives separately", () => {
  const launchCenter = buildLaunchCenterView({
    projectId: "project-3",
    sections: [
      { module: "branding", state: "Ready", output: { brandName: "BrightNest" } },
      { module: "website", state: "Ready", reviewState: "Approved", output: { websiteOverview: "Ready to review." } },
      { module: "marketing", state: "Ready", output: { strategy: "saved" } },
      { module: "seo", state: "Ready", output: { audit: "saved" } },
      { module: "sales", state: "Ready", output: { summary: "saved" } },
    ],
    publication: { status: "unpublished" },
    socialConnections: [],
  });

  assert.equal(launchCenter.headline, "Your business is ready");
  assert.equal(launchCenter.nextStep.title, "Publish your website");
});
