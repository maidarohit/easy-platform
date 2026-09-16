import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { parsePageView, persistentVisitorId, reportingWindow, VISITOR_KEY } from "../../app/lib/platform-analytics.ts";
import { GET } from "../../app/api/admin/platform-analytics/route.ts";
import { POST } from "../../app/api/platform-analytics/page-view/route.ts";
import { POST as ownerAccess } from "../../app/api/admin/platform-analytics/access/route.ts";
import { authorizePlatformOwnerCookie } from "../../app/lib/platform-analytics-owner.ts";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const event = { visitorId: "14dc8513-37a1-4d69-9c43-71b56ba5be09", sessionId: "65fd8634-e0b7-43f5-8dd5-03e53c9cb654", pathname: "/pricing" };

test("page views only retain allowed fields and strip sensitive referrer components", () => {
  assert.deepEqual(parsePageView({ ...event, referrer: "https://user:password@example.com/private?token=secret#email", utm_source: " newsletter ", ip: "192.0.2.1", userId: "customer", timestamp: "2000-01-01" }), {
    ...event, referrer: "https://example.com", utmSource: "newsletter", utmMedium: null, utmCampaign: null,
  });
});

test("rejects invalid sessions, non-pathnames and administrative routes", () => {
  for (const pathname of ["//evil.com", "https://evil.com", "/?token=secret", "/a#secret", "/a\\b", "/admin/platform-analytics", "/boss", "/api/projects"]) {
    assert.equal(parsePageView({ ...event, pathname }), null, pathname);
  }
  assert.equal(parsePageView({ ...event, sessionId: "customer-uid" }), null);
  assert.equal(parsePageView({ ...event, visitorId: undefined }), null);
  assert.equal(parsePageView({ ...event, visitorId: "email@example.com" }), null);
  assert.equal(parsePageView(null), null);
  assert.equal(parsePageView({ ...event, pathname: "/" + "a".repeat(1024) }), null);
});

test("persistent visitors are shared across tabs, sessions and browser restarts", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let created = 0;
  const create = () => { created++; return event.visitorId; };
  const firstTab = persistentVisitorId(storage, create);
  const secondTab = persistentVisitorId({ ...storage }, create);
  const reopenedBrowser = persistentVisitorId({ ...storage }, create);
  assert.equal(firstTab, secondTab);
  assert.equal(firstTab, reopenedBrowser);
  assert.equal(created, 1);
  assert.deepEqual([...values.keys()], [VISITOR_KEY]);
  assert.equal(parsePageView({ ...event, visitorId: secondTab, sessionId: "bd8c7280-e67b-4c06-a4ee-54a58381e7ec" }).visitorId, firstTab);
  values.set(VISITOR_KEY, "invalid");
  assert.equal(persistentVisitorId(storage, create), event.visitorId);
  assert.equal(created, 2);
});

test("Kolkata reporting rolls over at 18:30 UTC and handles month/year/leap boundaries", () => {
  const before = reportingWindow(new Date("2026-09-17T18:29:59.999Z"));
  const after = reportingWindow(new Date("2026-09-17T18:30:00.000Z"));
  assert.equal(before.today.toISOString(), "2026-09-16T18:30:00.000Z");
  assert.equal(after.today.toISOString(), "2026-09-17T18:30:00.000Z");
  assert.equal(after.sevenDays.toISOString(), "2026-09-11T18:30:00.000Z");
  assert.equal(after.thirtyDays.toISOString(), "2026-08-19T18:30:00.000Z");
  const year = reportingWindow(new Date("2026-12-31T18:30:00Z"));
  assert.equal(year.today.toISOString(), "2026-12-31T18:30:00.000Z");
  assert.equal(year.sevenDays.toISOString(), "2026-12-25T18:30:00.000Z");
  assert.equal(year.thirtyDays.toISOString(), "2026-12-02T18:30:00.000Z");
  assert.equal(reportingWindow(new Date("2024-02-29T18:30:00Z")).sevenDays.toISOString(), "2024-02-23T18:30:00.000Z");
});

test("page cookie and API require the real server owner allowlist after Firebase verification", async () => {
  const app = getApps()[0] ?? initializeApp({ projectId: "platform-analytics-test" });
  const original = process.env.BOSS_ADMIN_UIDS;
  process.env.BOSS_ADMIN_UIDS = "platform-owner";
  const verify = mock.method(getAuth(app), "verifyIdToken", async (token) => {
    if (token === "invalid" || token === "expired") throw new Error("Invalid token");
    return { uid: token, exp: Math.floor(Date.now() / 1000) + 1800 };
  });
  const request = (token) => new Request("https://example.com/api/admin/platform-analytics", { headers: { authorization: `Bearer ${token}` } });
  try {
    for (const token of ["invalid", "expired", "ordinary-customer", "platform-owner"]) {
      const expected = token === "platform-owner" ? 200 : token === "ordinary-customer" ? 403 : 401;
      assert.equal((await authorizePlatformOwnerCookie(token)).status, expected);
      if (expected !== 200) assert.equal((await GET(request(token))).status, expected);
      const access = await ownerAccess(new Request("https://example.com/api/admin/platform-analytics/access", {
        method: "POST", headers: { origin: "https://example.com", authorization: `Bearer ${token}` },
      }));
      assert.equal(access.status, expected === 200 ? 204 : expected);
      if (expected === 200) {
        assert.match(access.headers.get("set-cookie"), /HttpOnly/i);
        assert.match(access.headers.get("set-cookie"), /SameSite=strict/i);
        assert.match(access.headers.get("set-cookie"), /Path=\/admin/i);
      } else assert.equal(access.headers.get("set-cookie"), null);
    }
    assert.equal((await authorizePlatformOwnerCookie(undefined)).status, 401);
    process.env.BOSS_ADMIN_UIDS = "";
    assert.equal((await authorizePlatformOwnerCookie("platform-owner")).status, 403, "allowlist removal takes effect on the next request");
    assert.equal((await ownerAccess(new Request("https://example.com/api/admin/platform-analytics/access", {
      method: "POST", headers: { origin: "https://evil.com", authorization: "Bearer platform-owner" },
    }))).status, 403);
  } finally {
    verify.mock.restore();
    if (original === undefined) delete process.env.BOSS_ADMIN_UIDS;
    else process.env.BOSS_ADMIN_UIDS = original;
  }
});

test("campaign fields are bounded and unsafe referrers are discarded", () => {
  const parsed = parsePageView({ ...event, utm_campaign: "a".repeat(1000), referrer: "javascript:alert(1)" });
  assert.equal(parsed.utmCampaign.length, 200);
  assert.equal(parsed.referrer, null);
});

test("analytics read rejects unauthenticated requests without querying the database", async () => {
  const response = await GET(new Request("https://example.com/api/admin/platform-analytics"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("collector rejects cross-origin, malformed and oversized requests before database writes", async () => {
  const request = (body, origin = "https://example.com") => new Request("https://example.com/api/platform-analytics/page-view", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body,
  });
  assert.equal((await POST(request(JSON.stringify(event), "https://evil.com"))).status, 403);
  assert.equal((await POST(request("{"))).status, 400);
  assert.equal((await POST(request(JSON.stringify({ ...event, sessionId: "bad" })))).status, 400);
  assert.equal((await POST(request("x".repeat(8193)))).status, 413);
});
