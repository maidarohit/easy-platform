import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublishedBusinessSnapshot, validatePublishedBusinessSnapshot } from "../../app/lib/business-publication.ts";
import { publicContactMethods, validatePublicContactSettings } from "../../app/lib/public-contact.ts";
import { validatePublicInquiry } from "../../app/lib/public-inquiry.ts";
import { publicContact, publicSocialLinks } from "../../app/lib/public-business-presentation.ts";

const preview = { business: { name: "Example", industry: null, goal: null, description: null }, brand: null, website: null, marketing: null, search: null, journey: null };

test("email, phone and WhatsApp require explicit valid settings", () => {
  const email = validatePublicContactSettings({ email: "Owner@Example.com" }); assert.equal(email.valid, true);
  if (email.valid) assert.equal(publicContactMethods(email.settings)[0].href, "mailto:owner@example.com");
  const phone = validatePublicContactSettings({ phone: "+91 98765 43210" }); assert.equal(phone.valid, true);
  const whatsapp = validatePublicContactSettings({ whatsapp: "+91 98765 43210" }); assert.equal(whatsapp.valid, true);
  if (whatsapp.valid) assert.equal(publicContactMethods(whatsapp.settings)[0].href, "https://wa.me/919876543210");
});

test("social URLs use allowlisted HTTPS provider hosts only", () => {
  const checked = validatePublicContactSettings({ instagram: "https://instagram.com/real", facebook: "https://facebook.com/real", linkedin: "https://linkedin.com/company/real" });
  assert.equal(checked.valid, true); if (!checked.valid) return;
  const snapshot = buildPublishedBusinessSnapshot(preview, checked.settings);
  assert.equal(publicSocialLinks(snapshot).length, 3);
  assert.equal(validatePublicContactSettings({ instagram: "https://evil.example/instagram" }).valid, false);
  assert.equal(validatePublicContactSettings({ website: "javascript:alert(1)" }).valid, false);
});

test("snapshot v2 contains only owner-approved public contact and v1 remains compatible", () => {
  const current = buildPublishedBusinessSnapshot(preview, { email: "public@example.com" });
  assert.equal(current.schemaVersion, 2); assert.equal(publicContact(current).label, "public@example.com");
  const legacy = { ...current, schemaVersion: 1 }; delete legacy.contact;
  assert.ok(validatePublishedBusinessSnapshot(legacy)); assert.equal(publicContact(legacy).methods.length, 0);
});

test("malformed phone and hidden account-shaped fields are rejected", () => {
  assert.equal(validatePublicContactSettings({ phone: "call me" }).valid, false);
  assert.equal(validatePublicContactSettings({ accountEmail: "private@example.com" }).valid, false);
});

test("public inquiry validation accepts fallback leads and rejects abuse", () => {
  assert.equal(validatePublicInquiry({ name: "Ada", email: "ada@example.com", phone: "", service: "Consulting", message: "Please tell me more.", company: "" }).valid, true);
  assert.equal(validatePublicInquiry({ name: "A", email: "bad", message: "short", company: "" }).valid, false);
  assert.equal(validatePublicInquiry({ name: "Ada", email: "ada@example.com", message: "Please tell me more.", company: "bot" }).valid, false);
});

test("public renderer has mobile inquiry fallback and preserves selected service", async () => {
  const [page, form, route] = await Promise.all([readFile("app/business/[slug]/page.tsx", "utf8"), readFile("app/business/[slug]/InquiryForm.tsx", "utf8"), readFile("app/api/public-business-inquiries/route.ts", "utf8")]);
  assert.match(page, /encodeURIComponent\(service\.title\).*#contact/); assert.match(page, /sm:grid-cols-2/); assert.match(page, /InquiryForm/);
  assert.match(form, /General enquiry/); assert.match(form, /name="email"/); assert.match(form, /name="company"/);
  assert.match(route, /pg_advisory_xact_lock/); assert.match(route, />= 5/); assert.match(route, /status: 429/);
  assert.doesNotMatch(`${page}\n${form}\n${route}`, /firebase-admin|socialConnections|projectMemory|OPENAI|N8N_/i);
});

test("contact settings are owner-scoped and never auto-copy Firebase identity", async () => {
  const route = await readFile("app/api/public-contact-settings/route.ts", "utf8");
  assert.match(route, /eq\(projects\.userId, userId\)/); assert.match(route, /verifyFirebaseIdToken/);
  assert.doesNotMatch(route, /getFirebaseDeliveryIdentity|emailVerified|phoneNumber/);
});
