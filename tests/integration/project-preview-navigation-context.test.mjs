import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildLaunchCenterView } from "../../app/lib/master-workspace-launch-center.ts";
import { withProjectId } from "../../app/lib/project-navigation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const readySections = [
  { module: "branding", state: "Ready", output: { brandName: "BrightNest" } },
  {
    module: "website",
    state: "Ready",
    reviewState: "Approved",
    output: { websiteOverview: "Saved website preview." },
  },
  { module: "marketing", state: "Ready", output: { marketingStrategy: "Saved" } },
  { module: "seo", state: "Ready", output: { seoAudit: "Saved" } },
  { module: "sales", state: "Ready", output: { executiveSummary: "Saved" } },
];

test("project-aware preview navigation preserves projectId and hashes", () => {
  assert.equal(withProjectId("/business-preview", "project-42"), "/business-preview?projectId=project-42");
  assert.equal(withProjectId("/business-preview?mode=edit", "project-42"), "/business-preview?mode=edit&projectId=project-42");
  assert.equal(withProjectId("/business-preview?projectId=old-project", "project-42"), "/business-preview?projectId=project-42");
  assert.equal(withProjectId("/master-workspace#advanced-tools", "project-42"), "/master-workspace?projectId=project-42#advanced-tools");
});

test("launch center preview and publish actions stay pinned to the current project", () => {
  const view = buildLaunchCenterView({
    projectId: "project-42",
    sections: readySections,
    publication: { status: "unpublished" },
    socialConnections: [],
  });

  assert.equal(view.primaryActions.previewWebsite, "/business-preview?projectId=project-42");
  assert.equal(view.primaryActions.publishOrEditWebsite, "/business-preview?projectId=project-42");
  assert.equal(view.primaryActions.continueSetup, "/master-workspace?projectId=project-42#advanced-tools");
});

test("sidebar and workspace preview entry points use shared project-aware navigation", async () => {
  const [sidebar, workspace] = await Promise.all([
    source("app/dashboard/components/Sidebar.tsx"),
    source("app/master-workspace/page.tsx"),
  ]);

  assert.match(sidebar, /import \{ withProjectId \} from "@\/app\/lib\/project-navigation"/);
  assert.match(sidebar, /return withProjectId\(path, projectId\);/);
  assert.match(sidebar, /label: "Preview"/);

  assert.match(workspace, /import \{ withProjectId \} from "@\/app\/lib\/project-navigation"/);
  assert.match(workspace, /const projectLink = \(path: string\) =>\s*withProjectId\(path, projectId\);/);
  assert.match(workspace, /Preview (?:& Edit My Business|, Edit & Publish)/);
});
