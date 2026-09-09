import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addEssentialWebsitePages, websiteMediaReference } from "../../app/lib/website-essential-pages.ts";
import { adaptLegacyWebsiteToSiteDocument, addWebsitePage } from "../../app/lib/website-site-document.ts";

const output = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
const base = () => adaptLegacyWebsiteToSiteDocument({ companyName: "Example Studio", template: "Modern", websiteOutput: output });
const services = [
  { id: "3f2d8e03-c21c-4c99-a219-3af9582e82f0", name: "Interior Design", slug: "interior-design", description: "Interior design for homes.", imageUrl: "/uploads/interior.jpg" },
  { id: "14712e48-51b1-43ec-a3ea-4838fae34ca0", name: "Space Planning", slug: "space-planning", description: "Practical space planning.", imageUrl: null },
];

test("essential aggregate and individual business page types use typed schema-v2 blocks", () => {
  const document = addEssentialWebsitePages(base(), { projectDescription: "Interior design services.", services, projectMedia: ["/uploads/project-one.jpg"] });
  assert.ok(document);
  const paths = new Set(document.pages.map((page) => page.path));
  for (const path of ["/services", "/services/interior-design", "/services/space-planning", "/projects", "/process", "/faq", "/contact"]) assert.ok(paths.has(path), path);
  assert.ok([...paths].some((path) => path.startsWith("/projects/") && path !== "/projects"));
  assert.equal(document.pages.find((page) => page.path === "/services")?.blocks[0].type, "services");
  assert.equal(document.pages.find((page) => page.path === "/services/interior-design")?.blocks[0].type, "serviceDetail");
  assert.equal(document.pages.find((page) => page.path === "/projects")?.blocks[0].type, "gallery");
  assert.equal(document.pages.find((page) => page.path === "/process")?.blocks[0].type, "process");
  assert.equal(document.pages.find((page) => page.path === "/faq")?.blocks[0].type, "faq");
  assert.equal(document.pages.find((page) => page.path === "/contact")?.blocks[0].type, "contact");
});

test("verified saved services and project media receive stable references without pricing", () => {
  const document = addEssentialWebsitePages(base(), { services, projectMedia: ["/uploads/project-one.jpg", "javascript:unsafe"] });
  const servicesBlock = document.pages.find((page) => page.path === "/services")?.blocks[0];
  assert.equal(servicesBlock.serviceIds.length, 2);
  const gallery = document.pages.find((page) => page.path === "/projects")?.blocks[0];
  assert.deepEqual(gallery.mediaIds, [websiteMediaReference("/uploads/project-one.jpg")]);
  assert.doesNotMatch(JSON.stringify(document), /price|javascript:unsafe/i);
});

test("unsupported proof, guarantees, history, and internal instructions never become page copy", () => {
  const document = addEssentialWebsitePages(base(), {
    projectDescription: "We started as an award-winning team with 100 clients.",
    services: [{ id: "safe-id", name: "Design", slug: "design", description: "Guaranteed results for every client." }, { id: "bad-id", name: "Primary: Lead strategy", description: "Internal" }],
  });
  const serialized = JSON.stringify(document);
  assert.doesNotMatch(serialized, /award-winning|100 clients|guaranteed results|Primary:|Lead strategy/);
  assert.match(serialized, /Design/);
});

test("existing pages, IDs, paths, blocks, navigation, and ordering are preserved", () => {
  const customized = addWebsitePage(base(), { title: "Our Services", path: "/services", type: "services" });
  const existing = customized.pages.find((page) => page.path === "/services");
  const document = addEssentialWebsitePages(customized, { services, projectMedia: [] });
  const preserved = document.pages.find((page) => page.path === "/services");
  assert.deepEqual(preserved, existing);
  assert.equal(document.navigation.items.find((item) => item.pageId === existing.id)?.label, "Our Services");
  assert.deepEqual(addEssentialWebsitePages(document, { services, projectMedia: [] }), document);
});

test("schema-v1 stays unchanged and essential generation is an explicit Page Manager action", async () => {
  const page = await readFile(new URL("../../app/dashboard/website-ai/page.tsx", import.meta.url), "utf8");
  assert.match(page, /onAddEssentialPages=\{addEssentialBusinessPages\}/);
  assert.match(page, /siteDocument \? <WebsitePageManager[\s\S]*Set up pages/);
  assert.match(page, /item\.kind === "service" && item\.isActive === true/);
});
