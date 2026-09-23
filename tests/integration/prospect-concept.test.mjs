import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeProspectSite } from "../../app/lib/prospect-site-composer.ts";
register("../prospect-renderer-loader.mjs", import.meta.url);
const { default: Concept } = await import("../../app/prospect-preview/ProspectConcept.tsx");
const input = { companyName: "Studio & Stone", businessDescription: "Independent ceramics studio. Workshops explore hand finishing.", businessType: "Ceramics", services: ["Workshops", "Repairs", "Commissions"], location: "Bristol", email: "hello@example.test", phone: "+44 1234 567890" };
const draft = (overrides = {}) => composeProspectSite({ ...input, ...overrides }, { template: "Minimal", colorPalette: "#173D32", typography: "Arial", structure: "Services, process and FAQ" });
const htmlFor = (value, render = value.prospectRender) => renderToStaticMarkup(createElement(Concept, { document: value.siteDocument, render }));

test("premium concept renders verified services, source description and all real contact details", () => {
  const html = htmlFor(draft());
  for (const text of ["Studio &amp; Stone", "Independent ceramics studio.", "Workshops", "Repairs", "Commissions", "Bristol", "hello@example.test", "+44 1234 567890", "Concept powered by Buzypeezy", "Private website concept · View only"]) assert.ok(html.includes(text), text);
  assert.equal((html.match(/class="pp-card"/g) || []).length, 3);
  assert.match(html, /<details/);
  assert.match(html, /Outline your needs/);
  assert.doesNotMatch(html, /<img|<iframe|<form|<input|<button|mailto:|tel:|https?:\/\//);
  assert.doesNotMatch(html, /testimonials|award-winning|years of experience|trusted by/i);
});

test("every navigation and CTA anchor resolves inside the view-only concept", () => {
  for (const value of [draft(), draft({ services: [], email: "", phone: "", location: "" })]) {
    const html = htmlFor(value);
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      assert.ok(match[1].startsWith("#"));
      assert.ok(ids.has(match[1].slice(1)), match[1]);
    }
  }
});

test("sparse snapshots omit unavailable services/contact/process without placeholders or fabricated facts", () => {
  const html = htmlFor(draft({ services: [], location: "", email: "", phone: "" }));
  assert.doesNotMatch(html, /id="services"|id="contact"|pp-card|pp-steps|have not been supplied|<img/);
  assert.match(html, /Independent ceramics studio/);
});

test("legacy documents render without metadata and never activate saved external actions", () => {
  const value = draft();
  value.siteDocument.pages[0].blocks[0].ctaHref = "https://example.test/pay";
  value.siteDocument.header.ctaHref = "https://example.test/pay";
  const html = htmlFor(value, null);
  assert.match(html, /Studio &amp; Stone/);
  assert.match(html, /hello@example.test/);
  assert.doesNotMatch(html, /example.test\/pay|<form|<img/);
});

test("hidden services and contact blocks stay hidden and HTML remains escaped", () => {
  const value = draft();
  value.siteDocument.pages[0].blocks.forEach(block => { if (["services", "contact"].includes(block.type)) block.visibility = "hidden"; });
  value.siteDocument.branding.name = "<script>alert(1)</script>";
  const html = htmlFor(value);
  assert.doesNotMatch(html, /id="services"|id="contact"|<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("styles provide mobile layouts, keyboard focus and reduced-motion support without hiding baseline content", async () => {
  const css = await readFile(new URL("../../app/prospect-preview/concept.module.css", import.meta.url), "utf8");
  assert.match(css, /max-width: 640px/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation-timeline: view\(\)/);
});
