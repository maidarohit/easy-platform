import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowBusinessPlanBadge } from "../../app/lib/sidebar-entitlement.ts";

test("Business Plan badges reflect only resolved authoritative entitlement", () => {
  assert.equal(shouldShowBusinessPlanBadge(true, true), false);
  assert.equal(shouldShowBusinessPlanBadge(true, false), true);
  assert.equal(shouldShowBusinessPlanBadge(true, null), false);
  assert.equal(shouldShowBusinessPlanBadge(false, false), false);
});
