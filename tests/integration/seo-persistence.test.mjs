import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readStoredSeoOpportunities } from "../../app/lib/seo-opportunity-safety.ts";

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

test("refresh loads saved output and deterministic audit without generation", async () => {
  const page = await readFile("app/seo-ai/page.tsx", "utf8");
  assert.match(page, /\/api\/project-outputs\?projectId=.*module=seo/);
  assert.match(page, /\/api\/seo-ai\?projectId=/);
  assert.match(page, /readStoredSeoOpportunities\(data\.output\?\.result\)/);
  assert.match(page, /Promise\.all/);
  assert.doesNotMatch(page.slice(page.indexOf("const loadSavedSEOOutput"), page.indexOf("const copyToClipboard")), /handleGenerateBrand|method:\s*["']POST["']/);
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
