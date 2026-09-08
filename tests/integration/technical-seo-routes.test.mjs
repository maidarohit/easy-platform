import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canonicalApplicationOrigin } from "../../app/lib/public-app-url.ts";
import robots from "../../app/robots.ts";

test("canonical application origin accepts only a root HTTPS production-style origin", () => {
  assert.equal(canonicalApplicationOrigin("https://buzypeezy.ai"), "https://buzypeezy.ai");
  assert.equal(canonicalApplicationOrigin("https://buzypeezy.ai/"), "https://buzypeezy.ai");
  for (const value of ["", "http://buzypeezy.ai", "https://user:secret@buzypeezy.ai", "https://buzypeezy.ai/path", "https://buzypeezy.ai?test=1", "javascript:alert(1)"]) {
    assert.equal(canonicalApplicationOrigin(value), null);
  }
});

test("robots allows public sites, blocks private application areas, and fails safely without an origin", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://buzypeezy.ai/";
    const configured = robots();
    assert.deepEqual(configured.rules.allow, ["/", "/business/", "/published-sites/"]);
    assert.ok(configured.rules.disallow.includes("/api/"));
    assert.ok(configured.rules.disallow.includes("/dashboard/"));
    assert.ok(configured.rules.disallow.includes("/billing"));
    assert.equal(configured.host, "https://buzypeezy.ai");
    assert.equal(configured.sitemap, "https://buzypeezy.ai/sitemap.xml");
    process.env.NEXT_PUBLIC_APP_URL = "http://unsafe.example";
    const malformed = robots();
    assert.equal(malformed.host, undefined); assert.equal(malformed.sitemap, undefined);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("sitemap reads only active public slugs and excludes private application routes", async () => {
  const source = await readFile("app/sitemap.ts", "utf8");
  assert.match(source, /businessPublications\.publicSlug/);
  assert.match(source, /publishedWebsites\.slug/);
  assert.match(source, /businessPublications\.status, "active"/);
  assert.match(source, /publishedWebsites\.status, "active"/);
  assert.doesNotMatch(source, /projects|projectOutputs|snapshot|dashboard|billing|api\//i);
  assert.match(source, /if \(!origin\) return \[\]/);
});

test("both public canonical routes share strict authoritative origin handling", async () => {
  const pages = await Promise.all([readFile("app/business/[slug]/page.tsx", "utf8"), readFile("app/published-sites/[slug]/page.tsx", "utf8")]);
  for (const page of pages) {
    assert.match(page, /canonicalApplicationOrigin\(\)/);
    assert.doesNotMatch(page, /new URL\(process\.env\.NEXT_PUBLIC_APP_URL/);
  }
});
