import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("canonical specialist inputs share one tenant-scoped project and memory read", async () => {
  const helper = await source("app/lib/easy-mode-project-context.ts");
  assert.match(helper, /leftJoin\(projectMemory/);
  assert.match(helper, /eq\(projects\.userId, context\.userId\)/);
  assert.match(helper, /eq\(projectMemory\.userId, context\.userId\)/);

  for (const file of [
    "branding-execution.ts",
    "content-execution.ts",
    "logo-execution.ts",
    "text-specialist-execution.ts",
    "easy-mode-ai-manager.ts",
  ]) {
    const contents = await source(`app/lib/${file}`);
    assert.match(contents, /loadOwnedProjectContext\(context\)/, file);
  }
});

test("independent logo and local branding-context reads overlap without parallel task execution", async () => {
  const logo = await source("app/lib/logo-execution.ts");
  const executor = await source("app/lib/easy-mode-executor.ts");
  assert.match(logo, /Promise\.all\(\[\s*loadOwnedProjectContext\(context\)/);
  assert.match(executor, /Promise\.all\(\[\s*loadOwnedProjectContext\(context\)/);
  assert.doesNotMatch(executor, /Promise\.all\([^]*execute(?:Branding|Text|Logo|Content)/);
});

test("AI Manager sends projected memory context without duplicated identity fields", async () => {
  const manager = await source("app/lib/easy-mode-ai-manager.ts");
  const projection = manager.slice(manager.indexOf("const [memory] = await db.select({"), manager.indexOf("}).from(projectMemory)"));
  for (const field of ["targetAudience", "brandStyle", "brandVoice", "brandColors", "typography", "marketingGoal", "additionalContext"]) {
    assert.match(projection, new RegExp(`${field}: projectMemory\\.${field}`));
  }
  assert.doesNotMatch(projection, /businessName|businessDescription|industry|userId|projectId/);
  assert.match(manager, /projectMemory: memory \?\? null/);
});

test("performance changes do not loosen validators, execution safety, or publishing controls", async () => {
  const [contracts, executor, manager] = await Promise.all([
    source("app/lib/easy-mode-execution-contracts.ts"),
    source("app/lib/easy-mode-executor.ts"),
    source("app/lib/easy-mode-ai-manager.ts"),
  ]);
  assert.match(executor, /bindUsage/);
  assert.match(executor, /markDispatching/);
  assert.match(executor, /completeAttempt/);
  assert.match(manager, /callbackUrl/);
  assert.doesNotMatch(executor, /publishWebsite|websitePublications/);
  assert.match(contracts, /validateOutput/);
});
