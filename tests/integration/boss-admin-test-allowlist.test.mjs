import assert from "node:assert/strict";
import test from "node:test";
import { isBossAdmin } from "../../app/lib/paid-entitlements.ts";

test("existing and optional test boss UID lists are unioned server-side", () => {
  const originalBosses = process.env.BOSS_ADMIN_UIDS;
  const originalTestBosses = process.env.BOSS_ADMIN_UIDS_TEST;
  try {
    process.env.BOSS_ADMIN_UIDS = " existing-boss , another-existing-boss ";
    process.env.BOSS_ADMIN_UIDS_TEST = " test-boss , another-test-boss ";
    assert.equal(isBossAdmin("existing-boss"), true, "existing boss remains authorized");
    assert.equal(isBossAdmin("test-boss"), true, "test boss is authorized additively");
    assert.equal(isBossAdmin("ordinary-user"), false, "non-boss remains rejected");
  } finally {
    if (originalBosses === undefined) delete process.env.BOSS_ADMIN_UIDS;
    else process.env.BOSS_ADMIN_UIDS = originalBosses;
    if (originalTestBosses === undefined) delete process.env.BOSS_ADMIN_UIDS_TEST;
    else process.env.BOSS_ADMIN_UIDS_TEST = originalTestBosses;
  }
});

test("optional test boss list may be absent without changing existing behavior", () => {
  const originalBosses = process.env.BOSS_ADMIN_UIDS;
  const originalTestBosses = process.env.BOSS_ADMIN_UIDS_TEST;
  try {
    process.env.BOSS_ADMIN_UIDS = "existing-boss";
    delete process.env.BOSS_ADMIN_UIDS_TEST;
    assert.equal(isBossAdmin("existing-boss"), true);
    assert.equal(isBossAdmin("test-boss"), false);
  } finally {
    if (originalBosses === undefined) delete process.env.BOSS_ADMIN_UIDS;
    else process.env.BOSS_ADMIN_UIDS = originalBosses;
    if (originalTestBosses === undefined) delete process.env.BOSS_ADMIN_UIDS_TEST;
    else process.env.BOSS_ADMIN_UIDS_TEST = originalTestBosses;
  }
});
