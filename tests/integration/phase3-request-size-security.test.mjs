import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateProjectMemoryBody,
  validateProjectMutationBody,
  validateProjectOutputBody,
} from "../../app/lib/project-request-validation.ts";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "../../app/lib/request-body.ts";
import {
  validateEntitlementDeleteBody,
  validateEntitlementPutBody,
} from "../../app/api/internal/boss/entitlements/route.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function request(body) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("project creation validates its 32 KB body and bounded fields", async () => {
  await assert.rejects(
    readLimitedJson(request({ id: "p", name: "x".repeat(33 * 1024) }), 32 * 1024),
    RequestBodyTooLargeError,
  );
  await assert.rejects(readLimitedJson(request('{"id":'), 32 * 1024), MalformedJsonBodyError);
  assert.equal(validateProjectMutationBody({ id: "p", name: "x".repeat(201) }), null);
  assert.equal(validateProjectMutationBody({ id: "p", name: "Project", brandDescription: "x".repeat(4_001) }), null);
  assert.equal(validateProjectMutationBody({ id: "p", name: "Project", unsafe: true }), null);
  assert.deepEqual(
    validateProjectMutationBody({ id: "p", userId: "client-uid", name: " Project ", industry: "Tech" }),
    { id: "p", name: "Project", industry: "Tech" },
  );
});

test("project creation retains the locked first-project exception and later entitlement check", async () => {
  const contents = await source("app/api/projects/route.ts");
  assert.match(contents, /pg_advisory_xact_lock/);
  assert.match(contents, /mayCreateInitialProject/);
  assert.match(contents, /hasNoProjects\s*&&\s*!allowance\.ok/);
  assert.match(contents, /if \(!allowance\.ok && !mayCreateInitialProject\)/);
  assert.ok(contents.indexOf("verifyFirebaseIdToken(req)") < contents.indexOf("readLimitedJson(req"));
  assert.ok(contents.indexOf("validateProjectMutationBody") < contents.indexOf("db\n      .select"));
});

test("project memory accepts bounded strings and rejects invalid types", async () => {
  await assert.rejects(
    readLimitedJson(request({ projectId: "p", additionalContext: "x".repeat(33 * 1024) }), 32 * 1024),
    RequestBodyTooLargeError,
  );
  assert.equal(validateProjectMemoryBody({ projectId: "p", industry: 7 }), null);
  assert.equal(validateProjectMemoryBody({ projectId: "p", additionalContext: "x".repeat(4_001) }), null);
  assert.deepEqual(
    validateProjectMemoryBody({ projectId: " p ", businessName: "Example", additionalContext: "Context" }),
    { projectId: "p", businessName: "Example", additionalContext: "Context" },
  );
});

test("project outputs enforce request, result-size, and nesting limits", async () => {
  await assert.rejects(
    readLimitedJson(request({ projectId: "p", module: "seo", result: "x".repeat(257 * 1024) }), 256 * 1024),
    RequestBodyTooLargeError,
  );
  assert.equal(validateProjectOutputBody({ projectId: "p", module: "seo", result: "x".repeat(250 * 1024 + 1) }), null);
  let nested = "leaf";
  for (let depth = 0; depth < 14; depth += 1) nested = { nested };
  assert.equal(validateProjectOutputBody({ projectId: "p", module: "seo", result: nested }), null);
  assert.deepEqual(
    validateProjectOutputBody({ projectId: "p", module: "SEO", result: { score: 90 } }),
    { projectId: "p", module: "seo", result: '{"score":90}' },
  );
  const contents = await source("app/api/project-outputs/route.ts");
  assert.ok(contents.indexOf("validateProjectOutputBody") < contents.indexOf("db\n      .select"));
});

test("boss entitlement bodies are exact, bounded schemas", async () => {
  await assert.rejects(
    readLimitedJson(request({ userId: "u", category: "projects", limit: 1, padding: "x".repeat(5 * 1024) }), 4 * 1024),
    RequestBodyTooLargeError,
  );
  assert.equal(validateEntitlementPutBody({ userId: "u", category: "projects", limit: 1, unknown: true }), null);
  assert.equal(validateEntitlementDeleteBody(["u", "projects"]), null);
  assert.deepEqual(
    validateEntitlementPutBody({ userId: " u ", category: "projects", limit: 2 }),
    { userId: "u", category: "projects", limit: 2, paidAccessDisabled: false },
  );
  assert.deepEqual(validateEntitlementDeleteBody({ userId: "u", category: "projects" }), { userId: "u", category: "projects" });
  const contents = await source("app/api/internal/boss/entitlements/route.ts");
  assert.ok(contents.indexOf("authorize(request)") < contents.indexOf("readEntitlementBody(request)"));
});
