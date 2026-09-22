import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { buildProspectDraft, validateProspectInput, prospectWebsitePayload } from "../../app/lib/prospect-preview-core.ts";
import { validateWebsiteSiteDocument } from "../../app/lib/website-site-document.ts";
import { authoredProspectBlocks, prospectPresentationMedia } from "../../app/lib/prospect-site-presentation.ts";
import { resolveWebsiteMedia } from "../../app/lib/business-site-visuals.ts";
register("../prospect-renderer-loader.mjs", import.meta.url);
const { default: Renderer } = await import("../../app/dashboard/components/WebsiteSiteRenderer.tsx");

const strategy = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map(key => [key,
  key === "siteStructure" ? "Home, services, process and FAQ" : key === "colourScheme" ? "#173D32 #FCFBF7" : key === "typography" ? "Inter" : "Invented awards, 100 clients, 90% growth, founded in 1900"]));
const input = (overrides = {}) => validateProspectInput({ companyName: "Source Business", website: "https://example.test", businessDescription: "Objects made by hand. Explore the supplied collection.", services: ["Repairs", "Workshops"], email: "hello@example.test", ...overrides });
const draft = (overrides) => buildProspectDraft(input(overrides), { output: strategy });
const render = (value, props = {}) => renderToStaticMarkup(createElement(Renderer, { document: value.siteDocument, renderingMode: "authored-prospect", serviceItems: value.prospectRender.services, ...props }));

test("authored HTML preserves every typed section and its saved order, including additional content", () => {
  const value = draft();
  value.siteDocument.pages[0].blocks.push({ id: "extra", type: "content", heading: "More information", body: "Source-backed information.", order: 2.5, visibility: "visible" });
  // The canonical schema requires integral order values.
  value.siteDocument.pages[0].blocks.forEach(block => block.order *= 2);
  assert.ok(validateWebsiteSiteDocument(value.siteDocument));
  const blocks = authoredProspectBlocks(value.siteDocument.pages[0]);
  const html = render(value);
  assert.deepEqual([...html.matchAll(/data-block-type="([^"]+)"/g)].map(match => match[1]), blocks.map(block => block.type));
  for (const type of ["services", "contact", "faq", "cta", "process"]) assert.ok(html.includes(`data-block-type="${type}"`));
  assert.match(html, /<details/);
  assert.match(html, /href="#services"/);
  assert.match(html, /id="services"/);
});

test("legacy renderer stays on the fixed homepage path", () => {
  const value = draft();
  const html = render(value, { renderingMode: "public", preview: true });
  assert.doesNotMatch(html, /data-block-type="faq"/);
  assert.match(html, /data-block-type="hero"/);
  assert.match(html, /data-block-type="cta"/);
});

test("prospect mode disables forms, catalogue, editing and external actions even with live props", () => {
  const value = draft();
  value.siteDocument.pages[0].blocks[0].ctaHref = "https://example.test/pay";
  const html = render(value, { preview: true, publicPageOnly: true, inquirySlug: "live", checkoutReady: true,
    editorMode: true, onBlockSelect() {}, contact: { email: "live@example.test" },
    catalogueItems: [{ id: "product", name: "Product", kind: "product", pricePaise: 100 }] });
  assert.doesNotMatch(html, /<form|<input|<button|data-editor-block|data-block-type="store"|mailto:|example.test\/pay/);
  assert.match(html, /<div inert=""><p[^>]*>Powered by/);
});

test("strategy claims never become facts; composition varies with source availability across businesses", () => {
  for (const businessType of ["Repair workshop", "Independent publisher", "Language tuition", "Unclassified business"]) {
    const value = draft({ businessType });
    assert.ok(validateWebsiteSiteDocument(value.siteDocument));
    assert.doesNotMatch(JSON.stringify(value), /Invented|100 clients|90%|1900/);
    assert.equal(value.prospectRender.industry, businessType);
  }
  const sparse = draft({ services: [], email: "" });
  assert.ok(!sparse.siteDocument.pages[0].blocks.some(block => ["services", "process", "faq"].includes(block.type)));
  const value = draft({ services: ["Repairs", "Repairs", "Guaranteed results with 100 clients"] });
  assert.equal(value.prospectRender.services.length, 1);
});

test("trusted source media wins, unsupported remote assets fail and no media leaves no image column", () => {
  assert.equal(input({ media: { hero: "https://untrusted.test/photo.jpg" } }), null);
  const checked = input({ media: { hero: "/images/verified-business.jpg" } });
  assert.ok(checked);
  assert.ok(!JSON.stringify(prospectWebsitePayload(checked)).includes("verified-business.jpg"));
  const media = prospectPresentationMedia(resolveWebsiteMedia({ industry: "Consulting", uploaded: checked.media }));
  assert.equal(media.hero.src, "/images/verified-business.jpg");
  assert.ok(media.work.every(item => item.source !== "matched"));
  const html = render(draft());
  assert.doesNotMatch(html, /data-website-media|lg:grid-cols-\[1.05fr/);
  const withMedia = render(draft(), { media: checked.media });
  assert.match(withMedia, /data-website-media/);
  assert.match(withMedia, /has-\[&gt;\[data-website-media\]\]/);
});

test("media columns exist only while the image wrapper exists, including after load failure", async () => {
  const compiler = await compile("@theme { --breakpoint-lg: 64rem; } @tailwind utilities;");
  const css = compiler.build(["lg:has-[>[data-website-media]]:grid-cols-[1.05fr_.95fr]"]);
  assert.match(css, /:has\(\s*>\s*\[data-website-media\]\)/);
  assert.match(css, /grid-template-columns: 1.05fr .95fr/);
});

test("service descriptions reuse matching source sentences rather than strategy claims", () => {
  const value = draft({ businessDescription: "Repairs cover the supplied collection. Workshops explore hand finishing." });
  assert.equal(value.prospectRender.services[0].description, "Repairs cover the supplied collection.");
  assert.equal(value.prospectRender.services[1].description, "Workshops explore hand finishing.");
});
