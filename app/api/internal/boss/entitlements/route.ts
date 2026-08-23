import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { entitlementOverrides } from "@/app/db/schema";
import { verifyFirebaseIdTokenAllowUnverified } from "@/app/lib/firebase-admin";
import { getCurrentUsageCounters, isBossAdmin } from "@/app/lib/paid-entitlements";
import { isUsageCategory } from "@/app/lib/plan-config";
import { getUserEntitlements, getUserSubscription } from "@/app/lib/subscriptions";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";

const ACCESS_CATEGORY = "__paid_access__";
const MAX_ENTITLEMENT_BODY_BYTES = 4 * 1024;
const MAX_USER_ID_LENGTH = 128;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function validateEntitlementPutBody(value: unknown) {
  if (!isPlainObject(value) || !hasExactKeys(value, ["userId", "category", "limit", "paidAccessDisabled"])) return null;
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const category = value.category === ACCESS_CATEGORY ? ACCESS_CATEGORY : value.category;
  const limit = value.limit === null ? null : value.limit;
  if (
    !userId ||
    userId.length > MAX_USER_ID_LENGTH ||
    (category !== ACCESS_CATEGORY && !isUsageCategory(category)) ||
    (limit !== null && (!Number.isSafeInteger(limit) || Number(limit) < 0)) ||
    (value.paidAccessDisabled !== undefined && typeof value.paidAccessDisabled !== "boolean")
  ) return null;
  return {
    userId,
    category,
    limit: limit as number | null,
    paidAccessDisabled: category === ACCESS_CATEGORY && value.paidAccessDisabled === true,
  };
}

export function validateEntitlementDeleteBody(value: unknown) {
  if (!isPlainObject(value) || !hasExactKeys(value, ["userId", "category"])) return null;
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const category = value.category;
  if (!userId || userId.length > MAX_USER_ID_LENGTH || (category !== ACCESS_CATEGORY && !isUsageCategory(category))) return null;
  return { userId, category };
}

async function readEntitlementBody(request: Request) {
  try {
    return { value: await readLimitedJson(request, MAX_ENTITLEMENT_BODY_BYTES) } as const;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { response: Response.json({ error: "Request body is too large" }, { status: 413 }) } as const;
    }
    if (error instanceof MalformedJsonBodyError) {
      return { response: Response.json({ error: "Invalid JSON body" }, { status: 400 }) } as const;
    }
    throw error;
  }
}

async function authorize(request: Request) {
  try {
    const token = await verifyFirebaseIdTokenAllowUnverified(request);
    return isBossAdmin(token.uid);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "Not found" }, { status: 404 });
  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });
  const [subscription, entitlements, overrides, usage] = await Promise.all([
    getUserSubscription(userId),
    getUserEntitlements(userId),
    db.select().from(entitlementOverrides).where(eq(entitlementOverrides.userId, userId)),
    getCurrentUsageCounters(userId),
  ]);
  return Response.json({
    subscription: subscription ? { plan: subscription.plan, status: subscription.status, currentPeriodStart: subscription.currentPeriodStart, currentPeriodEnd: subscription.currentPeriodEnd } : null,
    entitlements,
    usage,
    overrides: overrides.map(({ category, limit, paidAccessDisabled }) => ({ category, limit, paidAccessDisabled })),
  });
}

export async function PUT(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = await readEntitlementBody(request);
  if ("response" in parsed) return parsed.response;
  const body = validateEntitlementPutBody(parsed.value);
  if (!body) return Response.json({ error: "Invalid override" }, { status: 400 });
  const { userId, category, limit, paidAccessDisabled } = body;
  await db.insert(entitlementOverrides).values({
    userId,
    category,
    limit,
    paidAccessDisabled,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [entitlementOverrides.userId, entitlementOverrides.category],
    set: { limit, paidAccessDisabled, updatedAt: new Date() },
  });
  return Response.json({ updated: true });
}

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = await readEntitlementBody(request);
  if ("response" in parsed) return parsed.response;
  const body = validateEntitlementDeleteBody(parsed.value);
  if (!body) return Response.json({ error: "Invalid override" }, { status: 400 });
  const { userId, category } = body;
  await db.delete(entitlementOverrides).where(and(eq(entitlementOverrides.userId, userId), eq(entitlementOverrides.category, category)));
  return Response.json({ removed: true });
}
