import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("private-beta assistant uses the existing quota ledger before OpenAI", async () => {
  const [entitlements, assistant, usage] = await Promise.all([
    source("app/lib/paid-entitlements.ts"),
    source("app/api/assistant/route.ts"),
    source("app/lib/ai-usage.ts"),
  ]);
  assert.match(entitlements, /PRIVATE_BETA_CATEGORIES[^\n]+"assistantMessages"/);
  assert.match(entitlements, /const limit = categoryOverride\?\.limit \?\? configuredLimit/);
  assert.match(entitlements, /used >= limit/);
  assert.match(usage, /requirePaidModule\(userId, module\)/);
  assert.ok(assistant.indexOf("startAiUsage({") < assistant.indexOf('fetch("https://api.openai.com/v1/responses"'));
});
