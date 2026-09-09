import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStoredUiuxOutput, sanitizeUiuxOutput } from "../../app/lib/uiux-insight-safety.ts";
import { validateUiuxOutput } from "../../app/lib/easy-mode-execution-contracts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const context = {
  website: { published: true, url: "https://buzypeezy.ai/business/acme" },
  business: { name: "Acme", industry: "Design", location: "Bengaluru", services: ["Interior design"], description: "Interior design in Bengaluru.", targetAudience: "Homeowners", brandStyle: "Modern" },
  branding: { palette: "Navy #001122", typography: "Inter", voice: "Clear and confident", direction: "Modern and clear" },
};
const fields = ["accessibility", "designSystem", "desktopExperience", "microInteractions", "mobileExperience", "uiuxStrategy", "userFlow", "userPersonas", "wireframes"];
const output = (text) => Object.fromEntries(fields.map((field) => [field, text]));

test("UI/UX sanitizer treats research, metrics and compliance as unverified", () => {
  const result = sanitizeUiuxOutput(output("Usability testing found users preferred this. Conversion increased 35%. The website is WCAG compliant."), context);
  assert.doesNotMatch(result.uiuxStrategy, /testing found|35%|WCAG compliant/i);
  assert.match(result.uiuxStrategy, /hypotheses|testable objectives|formal audit/i);
});

test("saved UI/UX output is validated and sanitized without generation", () => {
  const result = readStoredUiuxOutput(JSON.stringify(output("Research shows this flow works.")), context, validateUiuxOutput);
  assert.match(result.uiuxStrategy, /hypotheses/);
});

test("personas are hypothetical and unsupported capabilities remain proposed", () => {
  const result = sanitizeUiuxOutput(output("Add a dashboard, configurator, e-sign, calendar, automation, awards, testimonials, office locations and financing."), context);
  assert.match(result.userPersonas, /^Hypothetical \/ Proposed personas:/);
  assert.match(result.uiuxStrategy, /Proposed recommendation —/);
  assert.doesNotMatch(result.uiuxStrategy, /validate with the business owner/i);
  assert.match(result.designSystem, /Verified Branding system — palette: Navy #001122; typography: Inter; brand voice: Clear and confident; visual direction: Modern and clear/);
});

test("verified Branding replaces conflicting legacy palettes, fonts and direction", () => {
  const legacy = { ...output("Use a red and gold palette. Use Playfair and Roboto fonts. The brand voice is playful. Add an existing client portal and 3D viewer."), colourScheme: "Red #ff0000 and gold #ffaa00" };
  const result = readStoredUiuxOutput(JSON.stringify(legacy), context, validateUiuxOutput);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /red and gold|Playfair|Roboto|voice is playful/i);
  assert.match(result.designSystem, /Navy #001122/);
  assert.match(result.designSystem, /Inter/);
  assert.match(result.designSystem, /Clear and confident/);
  assert.equal(result.colourScheme, "Navy #001122");
  assert.match(result.uiuxStrategy, /Proposed recommendation —.*client portal and 3D viewer/i);
});

test("Design System keeps verified Branding distinct from proposed UI colors without duplication", () => {
  const proposed = { ...output("Keep content concise."), designSystem: "Branding\nBranding\nTypography: Roboto. UI accent color: Coral #ff7755." };
  const result = sanitizeUiuxOutput(proposed, context);
  assert.equal(result.designSystem.match(/Verified Branding system/g)?.length, 1);
  assert.match(result.designSystem, /^Verified Branding system — palette: Navy #001122; typography: Inter;/);
  assert.match(result.designSystem, /Proposed UI extension colors — UI accent color: Coral #ff7755\./);
  assert.doesNotMatch(result.designSystem, /Roboto|^Branding$/m);
  const restored = readStoredUiuxOutput(JSON.stringify(result), context, validateUiuxOutput);
  assert.equal(restored.designSystem.match(/Proposed UI extension colors/g)?.length, 1);
});

test("customer proof stays factual only when owner-approved and formatting artifacts are removed", () => {
  const unverified = sanitizeUiuxOutput(output("- Awards, testimonials and case studies.\nProposed recommendation — - Add referrals."), context);
  assert.match(unverified.uiuxStrategy, /Proposed recommendation — Awards, testimonials and case studies\./);
  assert.match(unverified.uiuxStrategy, /Proposed recommendation — Add referrals\./);
  assert.doesNotMatch(unverified.uiuxStrategy, /—\s*-/);

  const approved = sanitizeUiuxOutput(output("Show testimonials and case studies."), {
    ...context,
    business: { ...context.business, description: "Owner-approved testimonials and case studies are available." },
  });
  assert.equal(approved.uiuxStrategy, "Show testimonials and case studies.");
});

test("owned UI/UX context reads latest owned Branding direction", async () => {
  const contextSource = await source("app/lib/uiux-business-context.ts");
  const route = await source("app/api/uiux-ai/route.ts");
  assert.match(contextSource, /eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, userId\)[\s\S]*eq\(projectOutputs\.module, "branding"\)/);
  assert.match(contextSource, /desc\(projectOutputs\.updatedAt\)/);
  assert.match(contextSource, /palette: branding\.colorPalette[\s\S]*typography: branding\.typography[\s\S]*voice: branding\.brandVoice[\s\S]*direction: branding\.brandStyleGuide/);
  assert.match(route, /branding: context\.branding/);
});

test("standalone UI/UX uses owned context, idempotency and transactional persistence", async () => {
  const route = await source("app/api/uiux-ai/route.ts");
  assert.match(route, /loadOwnedUiuxContext\(uid, projectId\)/);
  assert.match(route, /claimIdempotentAiUsage/);
  assert.match(route, /requestId/);
  assert.match(route, /persistCompletedUiuxGeneration/);
  assert.ok(route.indexOf("persistCompletedUiuxGeneration") < route.lastIndexOf("return NextResponse.json({ uiuxContext: context, output }"));
  assert.match(route, /readStoredUiuxOutput/);
  assert.doesNotMatch(route, /const uiuxPayload = \{ \.\.\.body \}/);
});

test("UI/UX page hydrates through its authenticated API and preserves projectId", async () => {
  const page = await source("app/uiux-ai/page.tsx");
  assert.match(page, /authenticatedFetch\([\s\S]*\/api\/uiux-ai\?projectId=/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /sales-ai\?projectId=/);
  assert.doesNotMatch(page, /\/api\/project-outputs|userId: project\.userId|RAW RESPONSE|PARSED:|STATUS:/);
});

test("hard refresh keeps authenticated saved output after project memory initializes", async () => {
  const page = await source("app/uiux-ai/page.tsx");
  const firstEffect = page.slice(page.indexOf("useEffect(() => {"), page.indexOf("useEffect(() => {", page.indexOf("useEffect(() => {") + 1));
  const hydrationEffect = page.slice(page.indexOf("useEffect(() => {", page.indexOf("useEffect(() => {") + 1), page.indexOf("const copyToClipboard"));
  assert.doesNotMatch(firstEffect, /setBrandResult\(null\)/);
  assert.match(hydrationEffect, /setBrandResult\(null\)/);
  assert.match(hydrationEffect, /authenticatedFetch\([\s\S]*\/api\/uiux-ai\?projectId=/);
  assert.match(hydrationEffect, /setBrandResult\(\(data\.output \?\? null\)/);
});

test("authenticated UI/UX GET hydrates latest valid owned output without usage", async () => {
  const route = await source("app/api/uiux-ai/route.ts");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(get, /verifyFirebaseIdToken/);
  assert.match(get, /eq\(projectOutputs\.projectId, projectId\)[\s\S]*eq\(projectOutputs\.userId, uid\)[\s\S]*eq\(projectOutputs\.module, "uiux"\)/);
  assert.match(get, /orderBy\(desc\(projectOutputs\.updatedAt\), desc\(projectOutputs\.createdAt\)\)/);
  assert.match(get, /readStoredUiuxOutput/);
  assert.doesNotMatch(get, /claimIdempotentAiUsage|releaseFailedAiUsage|persistCompletedUiuxGeneration|fetch\(/);
});

test("Easy Mode applies the shared UI/UX sanitizer before persistence", async () => {
  const executor = await source("app/lib/easy-mode-executor.ts");
  assert.match(executor, /module === "uiux"[\s\S]*sanitizeUiuxOutput\(output, uiuxContext\)[\s\S]*insertProjectOutput/);
});

test("UI/UX persistence completes usage in the same transaction after output", async () => {
  const persistence = await source("app/lib/uiux-generation-persistence.ts");
  assert.match(persistence, /db\.transaction/);
  assert.match(persistence, /eq\(projects\.userId, input\.userId\)/);
  assert.ok(persistence.indexOf("projectOutputs") < persistence.indexOf('status: "success"'));
  assert.match(persistence, /eq\(aiUsage\.status, "started"\)/);
});
