import assert from "node:assert/strict";
import test from "node:test";
import { findEasyModeAttentionStage, mapEasyModeTasksToCustomerStages } from "../../app/lib/easy-mode-customer-progress-stages.ts";

test("stage mapping groups the seven internal tasks into Understanding, Building, and Ready", () => {
  const stages = mapEasyModeTasksToCustomerStages([
    { moduleId: "ai-manager", status: "completed", customerState: "Completed" },
    { moduleId: "branding", status: "completed", customerState: "Completed" },
    { moduleId: "website", status: "running", customerState: "In progress" },
    { moduleId: "marketing", status: "queued", customerState: "Waiting" },
    { moduleId: "seo", status: "queued", customerState: "Waiting" },
    { moduleId: "uiux", status: "queued", customerState: "Waiting" },
    { moduleId: "sales", status: "queued", customerState: "Waiting" },
  ]);

  assert.deepEqual(stages.map((stage) => [stage.badge, stage.title, stage.status]), [
    ["Understanding", "Understanding your business", "Completed"],
    ["Building", "Building your online presence", "In progress"],
    ["Ready", "Preparing your business workspace", "Waiting"],
  ]);
});

test("stage mapping marks Understanding complete only after AI Manager and Branding both complete", () => {
  const stages = mapEasyModeTasksToCustomerStages([
    { moduleId: "ai-manager", status: "completed", customerState: "Completed" },
    { moduleId: "branding", status: "queued", customerState: "Waiting" },
    { moduleId: "website", status: "queued", customerState: "Waiting" },
    { moduleId: "marketing", status: "queued", customerState: "Waiting" },
    { moduleId: "seo", status: "queued", customerState: "Waiting" },
    { moduleId: "uiux", status: "queued", customerState: "Waiting" },
    { moduleId: "sales", status: "queued", customerState: "Waiting" },
  ]);

  assert.equal(stages[0].status, "In progress");
  assert.equal(stages[1].status, "Waiting");
  assert.equal(stages[2].status, "Waiting");
});

test("stage mapping routes a Website failure to Building and preserves the task message", () => {
  const stages = mapEasyModeTasksToCustomerStages([
    { moduleId: "ai-manager", status: "completed", customerState: "Completed" },
    { moduleId: "branding", status: "completed", customerState: "Completed" },
    { moduleId: "website", status: "failed", customerState: "Needs attention", customerMessage: "This step needs attention before it can continue." },
    { moduleId: "marketing", status: "queued", customerState: "Waiting" },
    { moduleId: "seo", status: "queued", customerState: "Waiting" },
    { moduleId: "uiux", status: "queued", customerState: "Waiting" },
    { moduleId: "sales", status: "queued", customerState: "Waiting" },
  ]);

  assert.equal(stages[1].status, "Needs attention");
  assert.equal(stages[1].message, "This step needs attention before it can continue.");
  assert.equal(findEasyModeAttentionStage(stages)?.id, "building");
});

test("stage mapping keeps Ready incomplete until Marketing, SEO, UIUX, and Sales all complete", () => {
  const stages = mapEasyModeTasksToCustomerStages([
    { moduleId: "ai-manager", status: "completed", customerState: "Completed" },
    { moduleId: "branding", status: "completed", customerState: "Completed" },
    { moduleId: "website", status: "completed", customerState: "Completed" },
    { moduleId: "marketing", status: "completed", customerState: "Completed" },
    { moduleId: "seo", status: "completed", customerState: "Completed" },
    { moduleId: "uiux", status: "running", customerState: "In progress" },
    { moduleId: "sales", status: "queued", customerState: "Waiting" },
  ]);

  assert.equal(stages[0].status, "Completed");
  assert.equal(stages[1].status, "Completed");
  assert.equal(stages[2].status, "In progress");
});
