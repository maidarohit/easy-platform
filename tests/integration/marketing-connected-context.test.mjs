import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sanitizeMarketingInsights } from "../../app/lib/marketing-insight-safety.ts";

const route = fs.readFileSync("app/api/marketing-ai/route.ts", "utf8");
const page = fs.readFileSync("app/marketing-ai/page.tsx", "utf8");
const contextSource = fs.readFileSync("app/lib/marketing-business-context.ts", "utf8");
const persistence = fs.readFileSync("app/lib/marketing-generation-persistence.ts", "utf8");

const context = (overrides = {}) => ({
  website: { published: true, url: "https://buzypeezy.ai/business/acme" },
  business: { name: "Acme", industry: "Services", location: null, services: ["Design"], description: "Approved description", targetAudience: null, brandStyle: null },
  channels: { meta: "not_connected", linkedin: "connected", whatsapp: "not_connected" },
  savedEnquiries: 2, unavailableMetrics: ["website visitors", "CTR", "campaign ROI", "CAC"],
  ...overrides,
});

test("published and unpublished projects use only an authoritative URL", () => {
  assert.match(contextSource, /businessPublications\.status, "active"/);
  assert.match(contextSource, /publishedWebsites\.status, "active"/);
  assert.match(contextSource, /validatePublishedBusinessSnapshot/);
  assert.match(contextSource, /validateWebsitePublicationSnapshot/);
  assert.deepEqual(sanitizeMarketingInsights({ adCopy: "Visit https://invented.example/deal." }, context()), { adCopy: "Visit https://buzypeezy.ai/business/acme" });
  assert.deepEqual(sanitizeMarketingInsights({ adCopy: "Visit https://invented.example/deal." }, context({ website: { published: false, url: null } })), { adCopy: "Visit the website after it is published" });
});

test("social status is owner-scoped and disconnected channels are not claimed", () => {
  assert.match(contextSource, /eq\(socialConnections\.userId, userId\)/);
  assert.match(contextSource, /item\.status === "connected"/);
  assert.deepEqual(sanitizeMarketingInsights({ socialMediaStrategy: "Content was published on Facebook. LinkedIn is connected." }, context()), {
    socialMediaStrategy: "No channel publishing activity is verified in this Marketing strategy. LinkedIn is connected.",
  });
  assert.match(page, /Meta \(Facebook \/ Instagram\)/);
  assert.match(page, /WhatsApp:.*Approved contact/);
});

test("factual context GET is no-store and consumes no AI usage", () => {
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(get, /verifyFirebaseIdToken/);
  assert.match(get, /private, no-store/);
  assert.doesNotMatch(get, /claimIdempotentAiUsage|fetch\(webhook/);
  assert.match(contextSource, /publicBusinessInquiries/);
});

test("server persistence completes usage only after output save", () => {
  assert.match(route, /persistCompletedMarketingGeneration/);
  assert.match(persistence, /transaction\.update\(projectOutputs\)/);
  assert.match(persistence, /eq\(aiUsage\.status, "started"\)/);
  assert.match(route, /Your allowance was restored/);
  assert.doesNotMatch(page, /method: "POST"[\s\S]{0,180}\/api\/project-outputs/);
  assert.match(route, /readStoredMarketingInsights/);
  assert.match(page, /setBrandResult\(data\.marketingStrategy \?\? null\)/);
  assert.match(route, /claimIdempotentAiUsage/);
});

test("unsupported customer claims and fabricated metrics are removed", () => {
  assert.deepEqual(sanitizeMarketingInsights({ strategy: "Offer a free consultation. Campaign ROI will be 35%. Use the approved Design service.", marketingDashboard: { monthlyTraffic: 1000 } }, context()), {
    strategy: "Use the approved Design service.",
  });
  assert.match(route, /sanitizeMarketingInsights\(raw, context\)/);
  assert.doesNotMatch(page, /Estimated Monthly Leads|Monthly Traffic|funnelStages|channelPerformance/);
});
