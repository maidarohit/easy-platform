import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { uniquePublicNavigationItems } from "../../app/lib/public-business-presentation.ts";

test("public navigation keeps the first destination for each unique customer-facing label", () => {
  const items = uniquePublicNavigationItems([
    { href: "#home", label: "Home" },
    { href: "#services", label: "Services" },
    { href: "#store", label: " services " },
    { href: "#about", label: "About" },
  ]);
  assert.deepEqual(items, [
    { href: "#home", label: "Home" },
    { href: "#services", label: "Services" },
    { href: "#about", label: "About" },
  ]);
});

test("both public renderers retain their saved-snapshot and privacy boundaries", async () => {
  const [businessPage, websitePage, websitePublication] = await Promise.all([
    readFile("app/business/[slug]/page.tsx", "utf8"),
    readFile("app/published-sites/[slug]/page.tsx", "utf8"),
    readFile("app/lib/website-publication.ts", "utf8"),
  ]);
  assert.match(businessPage, /publicBusinessView\(published\.snapshot\)/);
  assert.match(businessPage, /uniquePublicNavigationItems/);
  assert.match(websitePage, /publicWebsitePublicationView\(stored\)/);
  assert.match(websitePublication, /recommendedPages: "", siteStructure: ""/);
  assert.match(websitePublication, /seoRecommendations: ""/);
  assert.match(websitePublication, /phone: "", email: "", address: "", whatsapp: ""/);
});
