import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import { publicBusinessView, publicContact, publicProcess, publicServices } from "../../app/lib/public-business-presentation.ts";
import { resolveWebsiteMedia } from "../../app/lib/business-site-visuals.ts";
import { buildWebsitePublicationSnapshot, publicWebsitePublicationView } from "../../app/lib/website-publication.ts";

const preview = (overrides = {}) => ({
  projectId: "private-project",
  business: { name: "Northstar", industry: "Consulting", goal: "Private growth goal", description: "Practical advice for growing teams." },
  brand: { name: "Northstar", tagline: "Clear advice, practical action", colours: ["#173D32"], colourDirection: "Internal palette notes", typography: "Internal typography notes", voice: "Internal voice strategy", logoConcept: "Draft logo", story: "We make complex decisions easier." },
  website: { heroHeadline: "Move forward with clarity", supportingText: "Advice shaped around your needs.", primaryCta: "Contact us", services: "Strategy consulting; Operations consulting", serviceCards: [], trust: "Clear communication; Tailored recommendations", about: "Practical support for growing teams.", features: "Thoughtful planning", contact: "private-account@example.com", heroImage: null, secondaryImage: null, businessVideo: null },
  marketing: { positioning: "Primary objective and segmentation", campaign: "Campaign timeline", audience: "Lead scoring targets", socialCards: [], campaignCards: [], sections: [] },
  search: { positioning: "Keyword research", keywords: "secret keyword list", keywordTags: ["private keyword"], localFocus: "SEO strategy", title: "Northstar Consulting", description: "Practical consulting for growing teams." },
  journey: { leadAction: "Lead scoring", enquiryPath: "Cold email outreach sequence", primaryCta: "Sales script", customerJourney: "Day 1 follow-up", audience: "Target customer profile" },
  approval: { approved: true, outputIds: ["one", "two", "three", "four", "five", "six", "seven"] },
  ...overrides,
});

test("new public snapshots exclude Marketing, Sales, UIUX and SEO research while retaining metadata", () => {
  const snapshot = buildPublishedBusinessSnapshot(preview());
  assert.equal(snapshot.marketing, null);
  assert.equal(snapshot.journey, null);
  assert.equal(snapshot.search?.keywords, null);
  assert.equal(snapshot.search?.positioning, null);
  assert.equal(snapshot.search?.title, "Northstar Consulting");
  assert.equal(snapshot.search?.description, "Practical consulting for growing teams.");
  assert.equal(snapshot.website?.heroHeadline, "Move forward with clarity");
});

test("legacy snapshots cannot feed private strategy into visible public sections", () => {
  const legacy = { ...buildPublishedBusinessSnapshot(preview()), marketing: preview().marketing, journey: preview().journey,
    search: preview().search };
  const view = publicBusinessView(legacy);
  assert.equal(view.marketing, null);
  assert.equal(view.journey, null);
  assert.equal(view.search?.keywords, null);
  assert.deepEqual(publicServices(view).map((item) => item.title), ["Strategy consulting", "Operations consulting"]);
  assert.doesNotMatch(JSON.stringify({ services: publicServices(view), process: publicProcess(view) }), /lead scoring|cold email|keyword|campaign timeline/i);
});

test("unsafe placeholders, fabricated proof, fake metrics and invented plans are omitted", () => {
  const dirty = buildPublishedBusinessSnapshot(preview({
    website: { ...preview().website, heroHeadline: "TBD", supportingText: "Trusted by 500+ customers...",
      primaryCta: "$X Growth Plan", services: "Free Plan; Pro Plan; Strategy consulting",
      serviceCards: [{ title: "TBD", description: "Guaranteed 99% success" }],
      trust: "Award-winning; 10 years in business; Testimonials", about: "Certified experts...", features: "$X" },
  }));
  const view = publicBusinessView(dirty);
  assert.equal(view.website?.heroHeadline, null);
  assert.equal(view.website?.supportingText, null);
  assert.equal(view.website?.primaryCta, null);
  assert.deepEqual(view.website?.serviceCards.map((item) => item.title), ["Strategy consulting"]);
  assert.doesNotMatch(JSON.stringify(view), /\$X|TBD|500\+|99%|testimonial|award-winning|10 years|Free Plan|Pro Plan/i);
});

test("generated/private contact stays hidden and only explicitly approved contact renders", () => {
  const hidden = buildPublishedBusinessSnapshot(preview());
  assert.equal(publicContact(hidden).methods.length, 0);
  const approved = buildPublishedBusinessSnapshot(preview(), { email: "hello@northstar.example", linkedin: "https://linkedin.com/company/northstar" });
  assert.deepEqual(publicContact(approved).methods.map((item) => item.value), ["hello@northstar.example", "View profile"]);
});

test("owner photos take priority, are not repeated, and absent media creates no slot", () => {
  const hero = "https://firebasestorage.googleapis.com/v0/b/demo/o/hero?alt=media";
  const work = "https://firebasestorage.googleapis.com/v0/b/demo/o/work?alt=media";
  const media = resolveWebsiteMedia({ industry: "Consulting", uploaded: { hero, work } });
  assert.equal(media.hero?.src, hero);
  assert.equal(media.work[0]?.src, work);
  assert.equal(new Set([media.hero?.src, ...media.work.map((item) => item.src), media.about?.src, ...media.services.map((item) => item.src)].filter(Boolean)).size,
    [media.hero?.src, ...media.work.map((item) => item.src), media.about?.src, ...media.services.map((item) => item.src)].filter(Boolean).length);
  assert.deepEqual(resolveWebsiteMedia({ industry: "Unknown field", uploaded: null }), { hero: null, work: [], about: null, services: [] });
});

test("both owner photo slots are carried into legacy publication snapshots", async () => {
  const route = await readFile("app/api/website-publications/route.ts", "utf8");
  assert.match(route, /hero: .*\.heroImage/);
  assert.match(route, /work: .*\.secondaryImage/);
});

test("pricing is sourced only from active saved catalogue products, never public strategy", async () => {
  const [page, presentation] = await Promise.all([
    readFile("app/business/[slug]/page.tsx", "utf8"),
    readFile("app/lib/public-business-presentation.ts", "utf8"),
  ]);
  assert.match(page, /projectProducts\.isActive, true/);
  assert.match(page, /formatInr\(item\.pricePaise\)/);
  assert.doesNotMatch(presentation, /pricingRecommendations|Free Plan|Growth Plan|Pro Plan/);
});

test("preview labels public website versus private strategy and existing controls remain", async () => {
  const page = await readFile("app/business-preview/page.tsx", "utf8");
  assert.match(page, /This is what your customers will see\./);
  assert.match(page, /private business plan — only you can see them/);
  assert.match(page, /\/api\/business-preview\/edits/);
  assert.match(page, /\["desktop", "tablet", "mobile"\]/);
  assert.match(page, /Upload main photo/);
});

test("legacy published-sites renderer strips briefs, implementation fields and unapproved contact", () => {
  const stored = buildWebsitePublicationSnapshot({
    companyName: "Northstar", industry: "Consulting", websiteGoal: "Primary objective: acquire leads",
    websiteRequirements: "Private implementation notes and target segmentation", template: "Modern",
    websiteOutput: { websiteOverview: "Clear consulting support.", websiteGoal: "Talk to our team",
      recommendedPages: "Site map", siteStructure: "Internal page layout", websiteFeatures: "Practical advice",
      designRecommendations: "Implementation notes", colourScheme: "Green", typography: "Inter",
      recommendedTechStack: "Next.js", seoRecommendations: "Keyword research" },
    websiteEdits: { companyName: "Northstar", heroHeadline: "Clear support", heroDescription: "Clear consulting support.",
      aboutText: "Practical help.", servicesText: "Strategy consulting", phone: "private-phone", email: "private@example.com",
      address: "Private address", whatsapp: "private-whatsapp", primaryCtaLabel: "Contact", primaryCtaLink: "/contact", template: "Modern" },
  });
  assert.ok(stored);
  const view = publicWebsitePublicationView(stored);
  assert.equal(view.websiteRequirements, "");
  assert.equal(view.websiteOutput.recommendedTechStack, "");
  assert.equal(view.websiteOutput.seoRecommendations, "");
  assert.equal(view.websiteEdits?.email, "");
  assert.equal(view.websiteEdits?.phone, "");
  assert.doesNotMatch(JSON.stringify(view), /segmentation|keyword research|implementation notes|private@example|private-phone/i);
});
