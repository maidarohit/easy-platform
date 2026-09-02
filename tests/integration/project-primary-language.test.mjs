import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSupportedLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
  supportedLanguageOrEnglish,
} from "../../app/lib/supported-languages.ts";
import { validateProjectMutationBody } from "../../app/lib/project-request-validation.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("all supported project language codes are accepted", () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 14);
  for (const primaryLanguage of SUPPORTED_LANGUAGE_CODES) {
    assert.equal(parseSupportedLanguageCode(primaryLanguage), primaryLanguage);
    assert.deepEqual(
      validateProjectMutationBody({ id: "p", name: "Project", primaryLanguage }),
      { id: "p", name: "Project", primaryLanguage },
    );
  }
});

test("unsupported project language codes are rejected", () => {
  for (const primaryLanguage of ["it", "EN", "en-US", "", null, 7]) {
    assert.equal(parseSupportedLanguageCode(primaryLanguage), null);
    assert.equal(validateProjectMutationBody({ id: "p", name: "Project", primaryLanguage }), null);
  }
});

test("missing project language safely falls back to English", () => {
  assert.equal(supportedLanguageOrEnglish(undefined), "en");
  assert.deepEqual(
    validateProjectMutationBody({ id: "p", name: "Project" }),
    { id: "p", name: "Project" },
  );
});

test("project persistence adds language without changing ownership or creation safeguards", async () => {
  const route = await source("app/api/projects/route.ts");
  assert.match(route, /primaryLanguage: supportedLanguageOrEnglish\(body\.primaryLanguage\)/);
  assert.match(route, /return body\[key\] !== undefined/);
  assert.match(route, /eq\(projects\.userId, userId\)/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /checkUsageAllowance\(userId, "projects"\)/);
  assert.doesNotMatch(route, /preferredLanguage/);
});

test("schema and migration enforce the same project language allowlist", async () => {
  const [schema, migration] = await Promise.all([
    source("app/db/schema.ts"),
    source("drizzle/0025_add-project-primary-language.sql"),
  ]);
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    assert.match(schema, new RegExp(`'${code}'`));
    assert.match(migration, new RegExp(`'${code}'`));
  }
  assert.match(schema, /primaryLanguage: varchar\("primary_language", \{ length: 2 \}\).*default\("en"\)\.notNull\(\)/);
  assert.match(migration, /varchar\(2\) NOT NULL DEFAULT 'en'/);
  assert.match(migration, /projects_primary_language_check/);
});
