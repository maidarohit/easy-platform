import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderedBusinessPreviewSections } from "../../app/lib/business-preview-sections.ts";

const pageSource = () => readFile(new URL("../../app/business-preview/page.tsx", import.meta.url), "utf8");

const previewWith = (sections) => ({
  business: { name: "Saved Business", industry: null, goal: null, description: null },
  brand: null,
  website: null,
  marketing: null,
  search: null,
  journey: null,
  approval: { approved: false, outputIds: [] },
  ...sections,
});

test("Brand and Website-only previews render only matching section tabs", () => {
  const sections = renderedBusinessPreviewSections(previewWith({ brand: {}, website: {} }));
  assert.deepEqual(sections.map(({ label, href }) => ({ label, href })), [
    { label: "Brand", href: "#brand" },
    { label: "Website", href: "#website" },
  ]);
});

test("previews with all supported content render every tab in section order", () => {
  const sections = renderedBusinessPreviewSections(previewWith({
    brand: {}, website: {}, marketing: {}, search: {}, journey: {},
  }));
  assert.deepEqual(sections.map((section) => section.label), [
    "Brand", "Website", "Marketing", "Search", "Customer Journey",
  ]);
});

test("each existing tab targets the correct rendered section anchor", async () => {
  const page = await pageSource();
  const sections = renderedBusinessPreviewSections(previewWith({
    brand: {}, website: {}, marketing: {}, search: {}, journey: {},
  }));
  for (const section of sections) {
    assert.equal(section.href, `#${section.id}`);
    assert.match(page, new RegExp(`<section id=["']${section.id}["']`));
  }
});

test("no rendered navigation tab points to a nonexistent anchor", async () => {
  const page = await pageSource();
  const anchorIds = new Set([...page.matchAll(/<section id=["']([^"']+)["']/g)].map((match) => match[1]));
  const previews = [
    previewWith({ brand: {}, website: {} }),
    previewWith({ brand: {}, website: {}, marketing: {}, search: {}, journey: {} }),
  ];
  for (const preview of previews) {
    for (const section of renderedBusinessPreviewSections(preview)) {
      assert.ok(anchorIds.has(section.href.slice(1)), `${section.href} must identify a rendered section`);
    }
  }
});
