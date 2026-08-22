import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  POST,
  validateBusinessIdeasInput,
} from "../../app/api/business-ideas/route.ts";
import {
  extractPublicClientIp,
  getGlobalDailyLimit,
} from "../../app/lib/public-ai-usage.ts";

const validInput = {
  interests: "Local food and technology",
  budget: "Under 1 lakh",
  businessType: "Online",
  workStyle: "Solo",
  skills: "Writing and sales",
  speed: "Within one month",
};

test("oversized Business Ideas bodies return 413 before provider work", async () => {
  const request = new Request("https://example.test/api/business-ideas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validInput, interests: "x".repeat(9_000) }),
  });

  const response = await POST(request);
  assert.equal(response.status, 413);

  const advertisedOversizedResponse = await POST(
    new Request("https://example.test/api/business-ideas", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "8193",
      },
      body: JSON.stringify(validInput),
    })
  );
  assert.equal(advertisedOversizedResponse.status, 413);
});

test("invalid and non-string Business Ideas fields return 400", async () => {
  for (const body of [[], null, { ...validInput, budget: 1000 }, { ...validInput, skills: {} }]) {
    const response = await POST(
      new Request("https://example.test/api/business-ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

    assert.equal(response.status, 400);
  }
});

test("normal valid input is accepted and trimmed by validation", () => {
  const input = validateBusinessIdeasInput({
    ...validInput,
    interests: `  ${validInput.interests}  `,
  });

  assert.ok(input);
  assert.equal(input.interests, validInput.interests);
});

test("field limits reject oversized long and short values", () => {
  assert.equal(
    validateBusinessIdeasInput({ ...validInput, interests: "x".repeat(501) }),
    null
  );
  assert.equal(
    validateBusinessIdeasInput({ ...validInput, speed: "x".repeat(201) }),
    null
  );
});

test("IP extraction prefers the first valid Vercel-forwarded address", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "invalid, 203.0.113.10, 203.0.113.11",
    "x-forwarded-for": "198.51.100.20",
    "x-real-ip": "192.0.2.30",
  });

  assert.equal(extractPublicClientIp(headers), "203.0.113.10");
});

test("global daily limit defaults safely to 50", () => {
  const original = process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT;

  try {
    delete process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT;
    assert.equal(getGlobalDailyLimit(), 50);
    process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT = "invalid";
    assert.equal(getGlobalDailyLimit(), 50);
    process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT = "0";
    assert.equal(getGlobalDailyLimit(), 50);
  } finally {
    if (original === undefined) {
      delete process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT;
    } else {
      process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT = original;
    }
  }
});

test("database reservation preserves all public quota and race guards", async () => {
  const source = await readFile(
    new URL("../../app/lib/public-ai-usage.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /const DEFAULT_DAILY_LIMIT = 2/);
  assert.match(source, /return getDailyLimit\(\) \* 3/);
  assert.match(source, /const SHORT_WINDOW_LIMIT = 2/);
  assert.match(source, /const SHORT_WINDOW_MS = 60_000/);
  assert.match(source, /PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT/);
  assert.match(source, /gte\(publicAiUsage\.createdAt, shortWindowStart\)/);
  assert.match(source, /gte\(publicAiUsage\.createdAt, startOfDay\)/);

  const globalLock = source.indexOf("public-business-ideas-global");
  const visitorLock = source.indexOf("visitor:${visitorId}");
  const ipLock = source.indexOf("ip:${ipHash}");
  const insert = source.indexOf(".insert(publicAiUsage)");

  assert.ok(globalLock >= 0);
  assert.ok(globalLock < visitorLock && visitorLock < ipLock && ipLock < insert);
});
