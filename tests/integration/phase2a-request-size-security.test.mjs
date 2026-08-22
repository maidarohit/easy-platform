import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateAssistantRequestBody } from "../../app/api/assistant/route.ts";
import { validateAiManagerRequestBody } from "../../app/api/ai-manager/route.ts";
import {
  POST as handleAiManagerCallback,
  validateAiManagerCallbackBody,
} from "../../app/api/ai-manager/jobs/[jobId]/route.ts";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "../../app/lib/request-body.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

function jsonRequest(value, headers = {}) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
}

test("Phase 2A routes map their configured body limits to 413", async () => {
  const cases = [
    ["app/api/assistant/route.ts", /MAX_REQUEST_BODY_BYTES\s*=\s*32\s*\*\s*1024/],
    ["app/api/ai-manager/route.ts", /MAX_REQUEST_BODY_BYTES\s*=\s*32\s*\*\s*1024/],
    ["app/api/ai-manager/jobs/[jobId]/route.ts", /MAX_CALLBACK_BODY_BYTES\s*=\s*256\s*\*\s*1024/],
  ];

  for (const [path, limitPattern] of cases) {
    const contents = await source(path);
    assert.match(contents, limitPattern);
    assert.match(contents, /readLimitedJson\(request,/);
    assert.match(contents, /RequestBodyTooLargeError/);
    assert.match(contents, /status:\s*413/);
    assert.match(contents, /MalformedJsonBodyError/);
    assert.match(contents, /status:\s*400/);
  }
});

test("Assistant authentication remains before bounded body parsing", async () => {
  const contents = await source("app/api/assistant/route.ts");
  assert.ok(
    contents.indexOf("verifyFirebaseIdToken(request)") < contents.indexOf("readLimitedJson(request"),
  );
});

test("Assistant validation bounds messages and preserves newest-ten history", () => {
  const normal = validateAssistantRequestBody({
    projectId: "project-1",
    message: "What should I do next?",
    messages: Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message-${index}`,
    })),
    currentPage: "/dashboard",
  });
  assert.ok(normal);
  assert.equal(normal.messages.length, 10);
  assert.equal(normal.messages[0].content, "message-2");
  assert.equal(validateAssistantRequestBody({ projectId: "p", message: "x".repeat(4_001) }), null);
  assert.equal(validateAssistantRequestBody({
    projectId: "p",
    message: "hello",
    messages: [{ role: "user", content: "x".repeat(4_001) }],
  }), null);
});

test("Assistant malformed and oversized JSON are distinguished without provider work", async () => {
  await assert.rejects(
    readLimitedJson(jsonRequest('{"message":'), 32 * 1024),
    MalformedJsonBodyError,
  );
  await assert.rejects(
    readLimitedJson(jsonRequest({ padding: "x".repeat(33 * 1024) }), 32 * 1024),
    RequestBodyTooLargeError,
  );
});

const validManagerBody = {
  projectId: "project-1",
  companyName: "Example Company",
  businessDescription: "A bounded business description.",
  industry: "Technology",
  businessGoal: "Increase sales",
  analyticsContext: { monthlyVisitors: 100 },
};

test("AI Manager accepts its existing payload and rejects unsafe additions", () => {
  assert.deepEqual(validateAiManagerRequestBody(validManagerBody), validManagerBody);
  assert.equal(validateAiManagerRequestBody({ ...validManagerBody, unsafe: true }), null);
  assert.equal(validateAiManagerRequestBody({
    ...validManagerBody,
    businessDescription: "x".repeat(4_001),
  }), null);
  assert.equal(validateAiManagerRequestBody({
    ...validManagerBody,
    analyticsContext: { report: "x".repeat(16 * 1024) },
  }), null);
});

test("AI Manager oversized JSON is stopped by the shared reader", async () => {
  await assert.rejects(
    readLimitedJson(jsonRequest({ ...validManagerBody, padding: "x".repeat(33 * 1024) }), 32 * 1024),
    RequestBodyTooLargeError,
  );
});

const validStrategy = Object.fromEntries(
  ["overview", "branding", "website", "marketing", "seo", "uiux", "sales", "analytics"]
    .map((key) => [key, `${key} strategy`]),
);

test("AI Manager callback validates bounded success and failure shapes", () => {
  assert.ok(validateAiManagerCallbackBody({
    jobId: "job-1",
    status: "completed",
    output: validStrategy,
  }, "job-1"));
  assert.ok(validateAiManagerCallbackBody({
    jobId: "job-1",
    status: "failed",
    error: "Workflow failed safely.",
  }, "job-1"));
  assert.equal(validateAiManagerCallbackBody({
    jobId: "job-1",
    status: "completed",
    output: { ...validStrategy, overview: "x".repeat(25 * 1024 + 1) },
  }, "job-1"), null);
  assert.equal(validateAiManagerCallbackBody({
    jobId: "job-1",
    status: "failed",
    error: "x".repeat(2_001),
  }, "job-1"), null);
});

test("AI Manager callback rejects oversized bodies and invalid auth", async () => {
  await assert.rejects(
    readLimitedJson(jsonRequest({ padding: "x".repeat(257 * 1024) }), 256 * 1024),
    RequestBodyTooLargeError,
  );

  const previousSecret = process.env.AI_MANAGER_CALLBACK_SECRET;
  process.env.AI_MANAGER_CALLBACK_SECRET = "test-callback-secret";
  try {
    const response = await handleAiManagerCallback(
      jsonRequest({ jobId: "job-1", status: "completed", output: validStrategy }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );
    assert.equal(response.status, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.AI_MANAGER_CALLBACK_SECRET;
    else process.env.AI_MANAGER_CALLBACK_SECRET = previousSecret;
  }
});
