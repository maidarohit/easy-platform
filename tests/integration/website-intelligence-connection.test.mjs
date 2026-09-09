import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyLatestWebsiteIntelligence } from "../../app/lib/website-intelligence-connection.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const website = {
  websiteOverview: "Existing overview", websiteGoal: "Contact us", recommendedPages: "Home; Services; About; Contact",
  siteStructure: "Existing structure", websiteFeatures: "Existing services", designRecommendations: "Existing design",
  colourScheme: "Old palette", typography: "Old font", recommendedTechStack: "Existing stack", seoRecommendations: "Existing SEO",
  websiteEdits: {
    companyName: "Existing Name", heroHeadline: "Existing headline", heroDescription: "Existing description",
    aboutText: "Existing about", servicesText: "Existing services", phone: "123", email: "owner@example.com",
    address: "Existing address", whatsapp: "456", primaryCtaLabel: "Contact", primaryCtaLink: "#contact", template: "Luxury",
  },
};
const branding = {
  brandName: "Acme", tagline: "Made well", story: "Acme creates thoughtful interiors.", mission: "Serve customers.", vision: "Better spaces.",
  brandVoice: "Warm and concise", colorPalette: "Navy #001122 and Coral #ff7755", typography: "Inter and Merriweather",
  logoConcept: "A simple mark", marketingSuggestions: "Share useful ideas", brandStyleGuide: "Use generous spacing and a warm editorial voice.",
};
const uiux = {
  accessibility: "Use accessible labels.", designSystem: "Use consistent components.", desktopExperience: "Use a clear desktop hierarchy.",
  microInteractions: "Use subtle feedback.", mobileExperience: "Use a compact mobile navigation.", uiuxStrategy: "Keep primary actions visible.",
  userFlow: "Home → Services → Contact", userPersonas: "Homeowners", wireframes: "Home; Services; About; Contact",
};
const seo = {
  seoAudit: "Audit", keywords: "interior design", metaTitles: "Acme Interior Design", metaDescriptions: "Thoughtful interior design for modern homes.",
  internalLinking: "Links", blogTopics: "Topics", technicalSEO: "Technical", kpis: "KPIs", growthRecommendations: "Growth",
};
const marketing = {
  marketingStrategy: "Private strategy", contentIdeas: "Ideas", socialMediaStrategy: "Social", adCopy: "Create a home that feels unmistakably yours.",
  contentCalendar: "Calendar", targetAudienceAnalysis: "Audience", emailMarketing: "Email", paidAdsStrategy: "Ads", typography: "Type",
  recommendedTechStack: "Stack", seoRecommendations: "SEO", funnelSuggestions: "Funnel", kpis: "KPIs", growthRecommendations: "Growth",
  marketingScore: "80", bestChannels: "Channels", campaignTimeline: "Timeline", customerJourney: "Journey", contentMix: "Mix",
};
const sales = {
  executiveSummary: "Private summary", targetCustomerProfile: "Private profile", salesFunnel: "Private funnel", leadGenerationStrategy: "Private lead plan",
  salesChannels: "Private channels", outreachStrategy: "Private outreach", pricingRecommendations: "Private pricing", salesKPIs: "Private KPIs",
  actionPlan: "Private plan", salesScript: "Private script", proposal: "Interior planning and design support tailored to each home.", closingStrategy: "Private close",
};

test("deterministic website merge applies authoritative and approved sources while preserving identity fields", () => {
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website,
    businessDna: { identity: { businessName: "Acme", industry: "Design" }, offer: { services: ["Interior design"] }, founderHistory: { whyStarted: "We help people enjoy their homes." } },
    branding, uiux, approvedSeo: seo, approvedMarketing: marketing, approvedSales: sales,
    approvedContent: { content: "Practical guidance for creating a more comfortable home." },
    approvedSocial: [{ content: "Explore ideas for your next space.", recommendedAction: "Book a consultation" }],
  });
  assert.ok(result);
  assert.equal(result.colourScheme, branding.colorPalette);
  assert.equal(result.typography, branding.typography);
  assert.equal(result.siteStructure, uiux.userFlow);
  assert.match(result.designRecommendations, /Warm and concise|compact mobile navigation/);
  assert.match(result.seoRecommendations, /Meta title: Acme Interior Design/);
  assert.match(result.seoRecommendations, /Meta description: Thoughtful interior design/);
  assert.equal(result.websiteEdits.primaryCtaLabel, "Book a consultation");
  assert.equal(result.websiteEdits.template, "Luxury");
  assert.deepEqual(
    { phone: result.websiteEdits.phone, email: result.websiteEdits.email, address: result.websiteEdits.address, whatsapp: result.websiteEdits.whatsapp },
    { phone: "123", email: "owner@example.com", address: "Existing address", whatsapp: "456" },
  );
  assert.doesNotMatch(JSON.stringify(result.websiteEdits), /Private strategy|Private funnel|Private script|Private pricing/);
});

test("unapproved customer-facing modules are absent unless passed through the approved boundary", () => {
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website,
    branding, uiux,
  });
  assert.ok(result);
  assert.equal(result.websiteEdits.heroDescription, "Existing description");
  assert.equal(result.websiteEdits.primaryCtaLabel, "Contact");
  assert.equal(result.seoRecommendations, "Existing SEO");
});

test("apply route is owner-scoped, updates only an existing draft, and cannot publish or call providers", async () => {
  const route = await source("app/api/website-ai/apply-intelligence/route.ts");
  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /eq\(projects\.id, projectId\), eq\(projects\.userId, userId\)/);
  assert.match(route, /eq\(projectOutputs\.id, website\.id\)[\s\S]*eq\(projectOutputs\.userId, userId\)[\s\S]*eq\(projectOutputs\.module, "website"\)/);
  assert.doesNotMatch(route, /insert\(projectOutputs\)|fetch\(|startAiUsage|completeAiUsage|publishedWebsites|websitePublicationVersions|projectPublicContacts|projectCommerce|projectPreviewCustomizations/);
  assert.match(route, /eq\(projectBusinessDna\.confirmed, true\)/);
  assert.match(route, /row\?\.approvedAt \? parsed\(row\.result\) : null/);
  assert.match(route, /socialDailyPosts\.status, "approved"[\s\S]*socialDailyPosts\.status, "published"/);
  assert.doesNotMatch(route, /analytics/);
});

test("Website AI action previews the merged draft and leaves publishing explicit", async () => {
  const page = await source("app/dashboard/website-ai/page.tsx");
  assert.match(page, /Apply latest business intelligence/);
  assert.match(page, /authenticatedFetch\("\/api\/website-ai\/apply-intelligence"[\s\S]*method: "PATCH"/);
  assert.match(page, /setBrandResult\(data\.output\)[\s\S]*setWebsiteEdits\(data\.output\.websiteEdits \|\| null\)/);
  assert.match(page, /Preview it before republishing/);
  assert.match(page, /Republish Changes/);
  assert.doesNotMatch(page.slice(page.indexOf("const applyLatestBusinessIntelligence"), page.indexOf("const activeWebsiteEdits")), /updatePublication|website-publications/);
});

test("approved SEO metadata is used safely only by the versioned publication snapshot", async () => {
  const publication = await import("../../app/lib/website-publication.ts");
  const snapshot = publication.buildWebsitePublicationSnapshot({
    companyName: "Acme", industry: "Design", websiteGoal: "Contact", websiteRequirements: "",
    template: "Luxury", websiteOutput: {
      ...website,
      seoRecommendations: "Meta title: Acme Interior Design\nMeta description: Thoughtful interior design for modern homes.",
    }, websiteEdits: website.websiteEdits,
  });
  assert.ok(snapshot);
  const publicSnapshot = publication.publicWebsitePublicationView(snapshot);
  assert.equal(publication.publicWebsiteSeoTitle(publicSnapshot), "Acme Interior Design");
  assert.equal(publication.publicWebsiteSeoDescription(publicSnapshot), "Thoughtful interior design for modern homes.");
  assert.equal(publicSnapshot.websiteOutput.colourScheme, "Old palette");
  assert.equal(publicSnapshot.websiteOutput.typography, "Old font");
  assert.equal(publication.publicWebsiteSeoTitle({ ...snapshot, websiteOutput: { ...snapshot.websiteOutput, seoRecommendations: "Meta title: Award-winning studio" } }), "Existing Name");
});

test("all Website AI templates receive connected Branding palette and typography", async () => {
  const preview = await source("app/dashboard/components/WebsitePreview.tsx");
  assert.match(preview, /connectedPrimaryColor = brandResult\?\.colourScheme/);
  assert.match(preview, /connectedFont = brandResult\?\.typography/);
  assert.match(preview, /style=\{connectedThemeStyle\}/);
  assert.match(preview, /backgroundColor: connectedPrimaryColor/);
});
