import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { publicContactMethods } from "../../app/lib/public-contact.ts";
import {
  concisePublicCopy,
  publicIndustryLabel,
  publicServiceText,
  publicServiceTitle,
  showcaseGridClass,
} from "../../app/lib/public-website-presentation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("internal categories are omitted while trustworthy industries remain readable", () => {
  assert.equal(publicIndustryLabel("small"), null);
  assert.equal(publicIndustryLabel("GENERATE_LEADS"), null);
  assert.equal(publicIndustryLabel("digital_marketing_agency"), "Digital marketing agency");
});

test("service breadcrumb normalization is global and not tied to an industry", () => {
  assert.equal(publicServiceTitle("Services > Residential Interior Design"), "Residential Interior Design");
  assert.equal(publicServiceTitle("Services > Payroll Compliance"), "Payroll Compliance");
  assert.equal(publicServiceText("Services > Brand Strategy; Services > Website Design"), "Brand Strategy;Website Design");
});

test("hero copy selects concise complete sentences and rejects internal planning copy", () => {
  const long = `${"Clear advice for growing teams. ".repeat(20)}This sentence should not be needed.`;
  const concise = concisePublicCopy(long);
  assert.ok(concise && concise.length <= 280 && concise.endsWith("."));
  assert.equal(concisePublicCopy("Scope, process, sample deliverables and planning notes."), null);
});

test("showcase layouts constrain one image and balance two or more images", () => {
  assert.match(showcaseGridClass(1), /max-w-4xl/);
  assert.match(showcaseGridClass(2), /md:grid-cols-2/);
  assert.match(showcaseGridClass(3), /lg:grid-cols-3/);
});

test("only explicitly saved contact methods become usable actions", () => {
  const methods = publicContactMethods({ email: "hello@example.com", phone: "+919876543210", whatsapp: "+919876543210" });
  assert.deepEqual(methods.map((item) => item.href), ["mailto:hello@example.com", "tel:+919876543210", "https://wa.me/919876543210"]);
  assert.equal(publicContactMethods({}).length, 0);
  assert.equal(methods.some((item) => item.label === "Instagram"), false);
});

test("both public systems use shared presentation and retain active-only publication security", async () => {
  const businessPage = await source("app/business/[slug]/page.tsx");
  const publishedLoader = await source("app/lib/public-website-publication.ts");
  const preview = await source("app/dashboard/components/WebsitePreview.tsx");
  assert.match(businessPage, /showcaseGridClass\(showcaseVisuals\.length\)/);
  assert.match(businessPage, /eq\(businessPublications\.status, "active"\)/);
  assert.match(businessPage, /<InquiryForm/);
  assert.match(publishedLoader, /publicWebsitePublicationView/);
  assert.match(publishedLoader, /eq\(publishedWebsites\.status, "active"\)/);
  for (const template of ["Modern", "Luxury", "Corporate", "Creative", "Minimal", "Dark"]) {
    assert.match(preview, new RegExp(`case "${template}"`));
  }
  assert.match(preview, /showcaseGridClass\(resolvedMedia\.work\.length\)/);
});
