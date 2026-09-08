import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { readStoredMarketingInsights, sanitizeMarketingInsights } from "../../app/lib/marketing-insight-safety.ts";

const page = fs.readFileSync("app/marketing-ai/page.tsx", "utf8");
const route = fs.readFileSync("app/api/marketing-ai/route.ts", "utf8");
const base = {
  website: { published: true, url: "https://buzypeezy.ai/business/acme" },
  business: { name: "Acme", industry: "Design", location: "Bengaluru", services: ["Interior Design"], description: "Thoughtful design services.", targetAudience: "Homeowners", brandStyle: "Modern" },
  channels: { meta: "not_connected", linkedin: "not_connected", whatsapp: "approved_contact" },
  savedEnquiries: 1, unavailableMetrics: ["website visitors", "CTR", "campaign ROI", "CAC"],
};

test("Funnel Suggestions uses the responsive full-width card rule", () => {
  assert.match(page, /\["funnelSuggestions", "typography"/);
  assert.match(page, /moduleClass \+ " md:col-span-2"/);
});

test("verified placeholders resolve and missing facts disappear without invention", () => {
  assert.deepEqual(sanitizeMarketingInsights({ copy: "Promote [service] in [City]." }, base), { copy: "Promote Interior Design in Bengaluru." });
  assert.deepEqual(sanitizeMarketingInsights({ copy: "Promote locally in [city]." }, { ...base, business: { ...base.business, location: null } }), { copy: "Promote locally." });
  assert.doesNotMatch(sanitizeMarketingInsights({ copy: "Use [unknown_variable] carefully." }, base).copy, /\[[^\]]+\]/);
});

test("unsupported offers, projections, budgets, CPL and demographics are removed", () => {
  const result = sanitizeMarketingInsights({ copy: "Recommend referral partnerships. Offer a Free 3D Walkthrough. Increase qualified leads by 50%. Target 200 leads/month. Use a $6,000 monthly ad budget. Expect $40-$120 CPL. Allocate 60% to Meta. Target ages 30-45 and high-net-worth buyers." }, base);
  assert.equal(result.copy, "Recommend referral partnerships.");
  const verifiedOffer = { ...base, business: { ...base.business, description: "Customers receive a free quote." } };
  assert.equal(sanitizeMarketingInsights({ copy: "Offer a free quote." }, verifiedOffer).copy, "Offer a free quote.");
});

test("disconnected channels remain recommendations and unverified assets become optional", () => {
  const result = sanitizeMarketingInsights({ social: "Schedule posts on Instagram. Launch a LinkedIn campaign. Use our CRM and testimonials. Recommend SEO and referral partnerships." }, base);
  assert.match(result.social, /Recommended channel — connect Meta/);
  assert.match(result.social, /Recommended channel — connect LinkedIn/);
  assert.match(result.social, /Consider an optional CRM/);
  assert.match(result.social, /Consider creating approved customer proof/);
  assert.match(result.social, /Recommend SEO and referral partnerships/);
});

test("Buzypeezy website is not replaced and legacy hydration is normalized without usage", () => {
  const stored = JSON.stringify({ tech: "Move the website to WordPress. Add Google Analytics.", copy: "Promote in [City]." });
  const result = readStoredMarketingInsights(stored, base);
  assert.match(result.tech, /Continue using the Buzypeezy website/);
  assert.match(result.tech, /Consider connecting an optional analytics tool/);
  assert.equal(result.copy, "Promote in Bengaluru.");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(get, /readStoredMarketingInsights/);
  assert.doesNotMatch(get, /claimIdempotentAiUsage|fetch\(webhook/);
});
