import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyLatestWebsiteIntelligence, normalizeWebsiteDraftForPersistence } from "../../app/lib/website-intelligence-connection.ts";

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
  assert.equal(result.changed, true);
  assert.deepEqual(result.modules, ["Branding", "UI/UX", "SEO", "Sales", "Social/Content", "Business DNA"]);
  assert.equal(result.output.colourScheme, branding.colorPalette);
  assert.equal(result.output.typography, branding.typography);
  assert.equal(result.output.siteStructure, uiux.userFlow);
  assert.match(result.output.designRecommendations, /Warm and concise|compact mobile navigation/);
  assert.match(result.output.seoRecommendations, /Meta title: Acme Interior Design/);
  assert.match(result.output.seoRecommendations, /Meta description: Thoughtful interior design/);
  assert.equal(result.output.websiteEdits.primaryCtaLabel, "Book a consultation");
  assert.equal(result.output.websiteEdits.template, "Luxury");
  assert.deepEqual(
    { phone: result.output.websiteEdits.phone, email: result.output.websiteEdits.email, address: result.output.websiteEdits.address, whatsapp: result.output.websiteEdits.whatsapp },
    { phone: "123", email: "owner@example.com", address: "Existing address", whatsapp: "456" },
  );
  assert.doesNotMatch(JSON.stringify(result.output.websiteEdits), /Private strategy|Private funnel|Private script|Private pricing/);
});

test("unapproved customer-facing modules are absent unless passed through the approved boundary", () => {
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website,
    branding, uiux,
  });
  assert.ok(result);
  assert.equal(result.output.websiteEdits.heroDescription, "Existing description");
  assert.equal(result.output.websiteEdits.primaryCtaLabel, "Contact");
  assert.equal(result.output.seoRecommendations, "Existing SEO");
});

test("no-change result reports an up-to-date draft with no applied modules", () => {
  const first = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website, branding, uiux,
  });
  assert.ok(first);
  const second = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website: first.output, branding, uiux,
  });
  assert.ok(second);
  assert.equal(second.changed, false);
  assert.deepEqual(second.modules, []);
});

test("partial change reports only the module that changed the draft", () => {
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" }, website, branding,
  });
  assert.ok(result);
  assert.equal(result.changed, true);
  assert.deepEqual(result.modules, ["Branding"]);
});

test("invalid existing website produces a failure result and no success metadata", () => {
  assert.equal(applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" },
    website: { websiteOverview: "Incomplete" }, branding,
  }), null);
});

test("legacy loadable website output with an extra hero field updates the existing draft", () => {
  const legacyWebsite = Object.fromEntries(Object.entries(website).filter(([field]) => field !== "websiteEdits"));
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" },
    website: { ...legacyWebsite, heroHeadline: "Strongest spaces start here" }, branding,
  });
  assert.ok(result);
  assert.equal(result.changed, true);
  assert.equal(result.output.websiteEdits.heroHeadline, "Strongest spaces start here");
  assert.equal(result.output.websiteEdits.primaryCtaLink, "#contact");
  assert.deepEqual(result.modules, ["Branding"]);
});

test("legacy website draft applies directly through safe server normalization", () => {
  const legacyWebsite = { ...website, designRecommendations: "A".repeat(4_500) };
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" },
    website: legacyWebsite, branding,
  });
  assert.ok(result);
  assert.equal(result.changed, true);
  assert.equal(result.output.designRecommendations.length <= 4_000, true);
});

test("intelligence normalization accepts benign data and file prose", () => {
  for (const seoRecommendations of [
    "Use structured data: to describe services.",
    "Maintain a file: naming guide for website assets.",
  ]) {
    const result = applyLatestWebsiteIntelligence({
      project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" },
      website: { ...website, seoRecommendations }, branding,
    });
    assert.ok(result);
  }
});

test("legacy website without saved edits safely normalizes a long website goal into the headline", () => {
  const legacyWebsite = Object.fromEntries(Object.entries(website).filter(([field]) => field !== "websiteEdits"));
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" },
    website: { ...legacyWebsite, websiteGoal: "Help customers plan thoughtful interiors. ".repeat(12) },
    branding,
  });
  assert.ok(result);
  assert.equal(result.output.websiteEdits.heroHeadline.length <= 200, true);
  assert.equal(result.output.websiteEdits.primaryCtaLink, "#contact");
});

test("internal strategy labels never reach public hero, headings, CTA, or public sections", () => {
  const labels = ["Primary:", "Objective:", "Strategy:", "Recommendation:", "Proposed recommendation:", "Goal:", "KPI:", "Funnel:", "Priority:"];
  const result = applyLatestWebsiteIntelligence({
    project: { name: "Project", companyName: "Acme", industry: "Interior design", brandStyle: "Modern" },
    website: {
      ...website,
      websiteOverview: "Primary: Generate qualified leads from homeowners.",
      websiteGoal: "Objective: Increase enquiries.",
      designRecommendations: "Strategy: Lead visitors toward conversion.",
      websiteFeatures: "Priority: Lead capture funnel.",
      websiteEdits: {
        ...website.websiteEdits,
        heroHeadline: "Goal: Generate qualified leads.",
        heroDescription: "Primary: Generate qualified leads.",
        aboutText: "Recommendation: Build authority.",
        servicesText: "Funnel: Convert prospects.",
        primaryCtaLabel: "KPI: Increase conversions",
      },
    },
  });
  assert.ok(result);
  const publicFields = [
    result.output.websiteEdits.heroHeadline, result.output.websiteEdits.heroDescription,
    result.output.websiteEdits.aboutText, result.output.websiteEdits.servicesText,
    result.output.websiteEdits.primaryCtaLabel, result.output.websiteOverview, result.output.websiteGoal,
  ].join("\n");
  for (const label of labels) assert.doesNotMatch(publicFields, new RegExp(label, "i"));
  assert.match(result.output.websiteEdits.heroDescription, /provides interior design services focused on your needs/i);
  for (const label of labels) {
    const legacyWebsite = Object.fromEntries(Object.entries(website).filter(([field]) => field !== "websiteEdits"));
    const labelled = applyLatestWebsiteIntelligence({
      project: { name: "Project", companyName: "Acme", industry: "Interior design", brandStyle: "Modern" },
      website: { ...legacyWebsite, websiteOverview: `${label} Generate qualified leads.` },
    });
    assert.ok(labelled);
    assert.doesNotMatch(labelled.output.websiteEdits.heroDescription, new RegExp(label, "i"));
  }
});

test("legacy website draft is canonicalized on save and then applies successfully", () => {
  const project = { name: "Project", companyName: "Acme", industry: "Design", brandStyle: "Modern" };
  const saved = normalizeWebsiteDraftForPersistence({
    project, website: { ...website, designRecommendations: "A".repeat(4_500), legacyLayout: "grid" },
  });
  assert.ok(saved);
  assert.equal(saved.designRecommendations.length, 4_000);
  assert.equal("legacyLayout" in saved, false);
  const result = applyLatestWebsiteIntelligence({ project, website: saved, branding });
  assert.ok(result);
  assert.equal(result.changed, true);
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
  assert.match(route, /Website intelligence merge rejected the saved draft\.[\s\S]*websiteOutputId/);
  assert.match(route, /Some saved website settings could not be applied safely\. Your website draft was not changed\./);
});

test("Save Project canonicalizes the same latest owned website row used by hydration and apply", async () => {
  const [page, outputs] = await Promise.all([
    source("app/dashboard/website-ai/page.tsx"), source("app/api/project-outputs/route.ts"),
  ]);
  const saveProject = page.slice(page.indexOf("const saveProject"), page.indexOf("const handleGenerateBrand"));
  assert.match(saveProject, /authenticatedFetch\("\/api\/projects"[\s\S]*authenticatedFetch\("\/api\/project-outputs"/);
  assert.match(saveProject, /module: "website"[\s\S]*JSON\.stringify\(brandResult\)/);
  assert.match(outputs, /normalizeWebsiteDraftForPersistence/);
  assert.match(outputs, /orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\)\)[\s\S]*limit\(1\)/);
  assert.match(outputs, /eq\(projectOutputs\.id, existingOutput\.id\)[\s\S]*eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, userId\)[\s\S]*eq\(projectOutputs\.module, moduleName\)/);
});

test("Website AI action previews the merged draft and leaves publishing explicit", async () => {
  const page = await source("app/dashboard/website-ai/page.tsx");
  assert.match(page, /Apply latest business intelligence/);
  assert.match(page, /authenticatedFetch\("\/api\/website-ai\/apply-intelligence"[\s\S]*method: "PATCH"/);
  assert.match(page, /setBrandResult\(data\.output\)[\s\S]*setWebsiteEdits\(data\.output\.websiteEdits \|\| null\)/);
  assert.match(page, /Your website draft has been updated according to your latest business changes\./);
  assert.match(page, /Your website is already up to date with your latest business settings\./);
  assert.match(page, /Preview your updated website before publishing\./);
  assert.match(page, /What changed/);
  assert.match(page, /setIntelligenceUpdate\(null\)[\s\S]*authenticatedFetch/);
  assert.match(page, /if \(update\.changed\) \{[\s\S]*toast\.success/);
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
  assert.match(preview, /designRecommendations: websiteEdits\.aboutText/);
  assert.match(preview, /seoRecommendations: websiteEdits\.heroDescription/);
});
