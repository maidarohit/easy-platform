import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { entitlementOverrides } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { getCurrentUsageCounters, isBossAdmin } from "@/app/lib/paid-entitlements";
import { isUsageCategory } from "@/app/lib/plan-config";
import { getUserEntitlements, getUserSubscription } from "@/app/lib/subscriptions";

const ACCESS_CATEGORY = "__paid_access__";

async function authorize(request: Request) {
  try {
    const token = await verifyFirebaseIdToken(request);
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
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });
  const value = body as Record<string, unknown>;
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const category = value.category === ACCESS_CATEGORY ? ACCESS_CATEGORY : value.category;
  const limit = value.limit === null ? null : value.limit;
  if (!userId || (category !== ACCESS_CATEGORY && !isUsageCategory(category)) || (limit !== null && (!Number.isSafeInteger(limit) || Number(limit) < 0))) {
    return Response.json({ error: "Invalid override" }, { status: 400 });
  }
  await db.insert(entitlementOverrides).values({
    userId,
    category,
    limit: limit as number | null,
    paidAccessDisabled: category === ACCESS_CATEGORY && value.paidAccessDisabled === true,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [entitlementOverrides.userId, entitlementOverrides.category],
    set: { limit: limit as number | null, paidAccessDisabled: category === ACCESS_CATEGORY && value.paidAccessDisabled === true, updatedAt: new Date() },
  });
  return Response.json({ updated: true });
}

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "Not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const category = value.category;
  if (!userId || (category !== ACCESS_CATEGORY && !isUsageCategory(category))) return Response.json({ error: "Invalid override" }, { status: 400 });
  await db.delete(entitlementOverrides).where(and(eq(entitlementOverrides.userId, userId), eq(entitlementOverrides.category, category)));
  return Response.json({ removed: true });
}
