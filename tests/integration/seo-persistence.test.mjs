import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findLatestValidSeoOutput, normalizeSeoOpportunities, readStoredSeoOpportunities } from "../../app/lib/seo-opportunity-safety.ts";

test("old and new stored SEO shapes rehydrate as recommendations", () => {
  const oldShape = JSON.stringify({ keywordResearch: "Relevant service topics", metaTitles: "A factual title", seoScore: "58/100", seoAudit: "Unverified audit" });
  assert.deepEqual(readStoredSeoOpportunities(oldShape), {
    keywordResearch: "Relevant service topics",
    metaTitles: "A factual title",
  });
  const newShape = { siteAudit: { score: 80 }, seoOpportunities: { blogTopics: "Helpful customer guides" } };
  assert.deepEqual(readStoredSeoOpportunities(newShape), { blogTopics: "Helpful customer guides" });
  assert.equal(readStoredSeoOpportunities(null), null);
  assert.equal(readStoredSeoOpportunities({ seoScore: "80/100" }), null);
});

test("multiple rows select the latest valid recommendation result", () => {
  const rows = [
    { id: "new-empty", result: JSON.stringify({ seoScore: "85/100" }) },
    { id: "older-valid", result: JSON.stringify({ keywordResearch: "Relevant topics" }) },
    { id: "oldest-valid", result: JSON.stringify({ blogTopics: "Customer guides" }) },
  ];
  assert.equal(findLatestValidSeoOutput(rows)?.id, "older-valid");
});

test("SEO placeholders use verified facts or disappear without invented locations", () => {
  const verified = normalizeSeoOpportunities(
    { keywordResearch: "Promote [service] in [city]. Add a page for [location]." },
    { services: ["Interior design"], location: "Bengaluru, India" },
  );
  assert.equal(verified.keywordResearch, "Promote Interior design in Bengaluru.\nAdd a page for Bengaluru, India.");
  const missing = normalizeSeoOpportunities({ keywordResearch: "Promote [service] in [city]. Serve [location] and [neighborhood]." });
  assert.doesNotMatch(String(missing.keywordResearch), /\[[^\]]+\]|\{[^}]+\}|<[^>]+>/);
  assert.doesNotMatch(String(missing.keywordResearch), /\bin\s*[.,]|\bserve\s*[.,]/i);
});

test("refresh loads saved output and deterministic audit without generation", async () => {
  const page = await readFile("app/seo-ai/page.tsx", "utf8");
  assert.match(page, /\/api\/project-outputs\?projectId=.*module=seo/);
  assert.match(page, /\/api\/seo-ai\?projectId=/);
  assert.match(page, /readStoredSeoOpportunities\(data\.output\?\.result\)/);
  assert.match(page, /Promise\.all/);
  assert.doesNotMatch(page.slice(page.indexOf("const loadSavedSEOOutput"), page.indexOf("const copyToClipboard")), /handleGenerateBrand|method:\s*["']POST["']/);
  const generation = page.slice(page.indexOf("const handleGenerateBrand"), page.indexOf("const resetStrategy"));
  assert.match(generation, /requestId:\s*crypto\.randomUUID\(\)/);
  assert.doesNotMatch(generation, /\/api\/project-outputs|userId\s*:/);
});

test("SEO hydration selects the newest valid owner-scoped row", async () => {
  const route = await readFile("app/api/project-outputs/route.ts", "utf8");
  assert.match(route, /eq\(projectOutputs\.projectId, projectId\)/);
  assert.match(route, /eq\(projectOutputs\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.module, moduleName\)/);
  assert.match(route, /orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\)\)/);
  assert.match(route, /findLatestValidSeoOutput\(candidates\)/);
});

test("deterministic audit GET is owner-scoped and never records AI usage", async () => {
  const route = await readFile("app/api/seo-ai/route.ts", "utf8");
  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getHandler, /verifyFirebaseIdToken/);
  assert.match(route, /eq\(projects\.id, projectId\), eq\(projects\.userId, uid\)/);
  assert.match(route, /eq\(businessPublications\.userId, uid\)/);
  assert.match(route, /eq\(publishedWebsites\.ownerUid, uid\)/);
  assert.match(getHandler, /Cache-Control["']:\s*["']private, no-store/);
  assert.doesNotMatch(getHandler, /startAiUsage|completeAiUsage|failAiUsage|getN8nWebhookConfig|fetch\s*\(/);
});

test("regeneration remains an explicit button action", async () => {
  const page = await readFile("app/seo-ai/page.tsx", "utf8");
  assert.match(page, /<button onClick=\{handleGenerateBrand\}/);
  assert.doesNotMatch(page, /useEffect\(handleGenerateBrand/);
});

test("server persists sanitized SEO before completing and returning success", async () => {
  const [route, persistence, usage] = await Promise.all([
    readFile("app/api/seo-ai/route.ts", "utf8"),
    readFile("app/lib/seo-generation-persistence.ts", "utf8"),
    readFile("app/lib/ai-usage.ts", "utf8"),
  ]);
  const normalizedAt = route.indexOf("const seoOpportunities = normalizeSeoOpportunities");
  const persistedAt = route.indexOf("await persistCompletedSeoGeneration");
  const returnedAt = route.indexOf("return NextResponse.json({ siteAudit, seoOpportunities })");
  assert.ok(normalizedAt >= 0 && normalizedAt < persistedAt && persistedAt < returnedAt);
  assert.match(persistence, /db\.transaction/);
  assert.match(persistence, /eq\(projects\.userId, input\.userId\)/);
  assert.match(persistence, /(?:insert|update)\(projectOutputs\)/);
  assert.match(persistence, /update\(aiUsage\)[\s\S]*status:\s*"success"/);
  assert.match(persistence, /eq\(aiUsage\.status, "started"\)/);
  assert.match(usage, /releaseFailedAiUsage[\s\S]*status:\s*"failed"[\s\S]*requestCount:\s*0/);
});

test("provider and persistence failures release quota while retries are idempotent", async () => {
  const [route, entitlements, reconciliation] = await Promise.all([
    readFile("app/api/seo-ai/route.ts", "utf8"),
    readFile("app/lib/paid-entitlements.ts", "utf8"),
    readFile("app/lib/n8n-executions.ts", "utf8"),
  ]);
  assert.match(route, /claimIdempotentAiUsage/);
  assert.match(route, /workflow:\s*`\$\{SEO_AI_WORKFLOW\}--request-\$\{requestId\}`/);
  assert.match(route, /if \(!claim\.created\)/);
  assert.match(route, /claim\.status !== "success"/);
  assert.match(route, /releaseFailedAiUsage/);
  assert.doesNotMatch(route, /completeAiUsage\(/);
  assert.match(entitlements, /inArray\(aiUsage\.status, \["started", "success"\]\)/);
  assert.match(reconciliation, /workflow\.split\("--request-", 1\)\[0\]/);
});
