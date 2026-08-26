import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recommendationFromSavedData, selectLatestSavedMarketing, socialLocalDate, validateEditedContent } from "../../app/lib/social-content.ts";
import { createSocialOAuthState, verifySocialOAuthState } from "../../app/lib/social-oauth-state.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("recommendation selects existing saved marketing text without generation", () => {
  const saved = "1. Share the existing customer story\n2. Explain the saved service process";
  const result = recommendationFromSavedData({ contentIdeas: saved }, null);
  assert.equal(result.content, "Share the existing customer story");
  assert.equal(result.source, "marketing:contentIdeas");
  assert.equal(recommendationFromSavedData(null, { conversation: { originalVisionText: "Our saved business vision" } }).content, "Our saved business vision");
});

test("latest valid canonical or legacy marketing output supplies customer-usable content", () => {
  const canonical = Object.fromEntries([
    "marketingStrategy", "contentIdeas", "socialMediaStrategy", "adCopy", "contentCalendar",
    "targetAudienceAnalysis", "emailMarketing", "paidAdsStrategy", "typography", "recommendedTechStack",
    "seoRecommendations", "funnelSuggestions", "kpis", "growthRecommendations", "marketingScore",
    "bestChannels", "campaignTimeline", "customerJourney", "contentMix",
  ].map((key) => [key, key === "contentIdeas" ? "1. Show a saved client transformation\n2. Share a service tip" : `Saved ${key}`]));
  const marketing = selectLatestSavedMarketing([
    { module: "marketing", result: "not-json" },
    { module: "marketing-ai", result: JSON.stringify(canonical) },
  ]);
  assert.equal(recommendationFromSavedData(marketing, null).content, "Show a saved client transformation");
});

test("confirmed DNA fields are deterministic fallback and internal strategy is not leaked", () => {
  const internalOnly = { marketingStrategy: "Internal implementation plan", socialMediaStrategy: "Internal channel strategy", kpis: "Private KPI plan" };
  const fallback = recommendationFromSavedData(internalOnly, { goals: { primaryGoal: "Attract more qualified enquiries" } });
  assert.equal(fallback.content, "Attract more qualified enquiries");
  assert.equal(fallback.source, "dna:primaryGoal");
  assert.equal(recommendationFromSavedData(internalOnly, null), null);
  assert.equal(recommendationFromSavedData(null, null), null);
});

test("daily date and edit validation are deterministic and bounded", () => {
  assert.equal(socialLocalDate(new Date("2026-08-27T23:30:00Z")), "2026-08-27");
  assert.equal(validateEditedContent(" Customer edit "), "Customer edit");
  assert.equal(validateEditedContent(""), null);
  assert.equal(validateEditedContent("x".repeat(2201)), null);
  assert.equal(validateEditedContent("bad\u0000text"), null);
});

test("workspace navigation preserves projectId and uses customer wording", async () => {
  const workspace = await source("app/master-workspace/page.tsx");
  assert.match(workspace, /projectLink\("\/social"\)/);
  assert.match(workspace, /Social &amp; Content/);
  const page = await source("app/social/page.tsx");
  assert.match(page, /Social &amp; Content/);
  assert.doesNotMatch(page, /Social AI|Content AI|Marketing AI|n8n/);
});

test("owner APIs enforce Firebase identity and project ownership", async () => {
  const routes = await Promise.all(["app/api/social/route.ts", "app/api/social/connect/route.ts", "app/api/social/disconnect/route.ts"].map(source));
  for (const route of routes) {
    assert.match(route, /verifyFirebaseIdToken/);
    assert.match(route, /eq\(projects\.userId, (?:userId|uid)\)/);
  }
  assert.doesNotMatch(routes.join("\n"), /userId\s*=\s*(?:body|value)/);
});

test("OAuth state is signed, owner-bound, expiring, and fail-closed", () => {
  const previous = process.env.SOCIAL_OAUTH_STATE_SECRET;
  process.env.SOCIAL_OAUTH_STATE_SECRET = "s".repeat(32);
  try {
    const state = createSocialOAuthState({ uid: "owner", projectId: "project", provider: "meta" }, 1_000);
    assert.equal(verifySocialOAuthState(state, "owner", 1_001)?.projectId, "project");
    assert.equal(verifySocialOAuthState(state, "other", 1_001), null);
    assert.equal(verifySocialOAuthState(`${state}x`, "owner", 1_001), null);
    assert.equal(verifySocialOAuthState(state, "owner", 1_000 + 10 * 60 * 1000 + 1), null);
  } finally { if (previous === undefined) delete process.env.SOCIAL_OAUTH_STATE_SECRET; else process.env.SOCIAL_OAUTH_STATE_SECRET = previous; }
});

test("refresh is idempotent and edits never mutate project outputs", async () => {
  const [route, schema, migration] = await Promise.all([source("app/api/social/route.ts"), source("app/db/schema.ts"), source("drizzle/0019_add-social-content-loop.sql")]);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /projectBusinessDna\.confirmed, true/);
  assert.match(route, /dailyPost\.status === "proposed"[\s\S]*!dailyPost\.originalContent\.trim\(\)[\s\S]*!dailyPost\.editedContent\?\.trim\(\)/);
  assert.match(schema, /social_daily_posts_project_date_unique/);
  assert.match(migration, /social_daily_posts_project_date_unique/);
  const patch = route.slice(route.indexOf("export async function PATCH"));
  assert.doesNotMatch(patch, /update\(projectOutputs\)|insert\(projectOutputs\)|delete\(projectOutputs\)/);
});

test("approval is explicit, skip does not regenerate, and disconnected publishing cannot succeed", async () => {
  const [route, page, provider] = await Promise.all([source("app/api/social/route.ts"), source("app/social/page.tsx"), source("app/lib/social-provider.ts")]);
  assert.match(page, /update\("approve"\)/); assert.match(page, /update\("skip"\)/);
  assert.match(page, /Connect a channel to publish/); assert.match(page, /recommendation\.status !== "approved"/);
  assert.match(route, /action === "publish"[\s\S]*Social publishing setup is not connected yet/);
  assert.doesNotMatch(route, /completeAiUsage|startAiUsage|N8N|OpenAI/);
  assert.match(provider, /throw new Error\("SOCIAL_PROVIDER_NOT_CONFIGURED"\)/);
  assert.doesNotMatch(provider, /fetch\(/);
});

test("social MVP contains no AI, n8n, or real social provider call", async () => {
  const contents = await Promise.all(["app/api/social/route.ts", "app/api/social/connect/route.ts", "app/api/social/callback/route.ts", "app/social/page.tsx"].map(source));
  assert.doesNotMatch(contents.join("\n"), /openai\.com|graph\.facebook|api\.linkedin|N8N_|business-build|business-dna\/analyze/);
});
