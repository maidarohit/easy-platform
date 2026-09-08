import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStoredUiuxOutput, sanitizeUiuxOutput } from "../../app/lib/uiux-insight-safety.ts";
import { validateUiuxOutput } from "../../app/lib/easy-mode-execution-contracts.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const context = {
  website: { published: true, url: "https://buzypeezy.ai/business/acme" },
  business: { name: "Acme", industry: "Design", location: "Bengaluru", services: ["Interior design"], description: "Interior design in Bengaluru.", targetAudience: "Homeowners", brandStyle: "Modern" },
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
