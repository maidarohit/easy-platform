import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isSubscriptionPlan } from "@/app/lib/subscription-policy";
import {
  createRazorpaySubscription,
  getRazorpayPlanId,
  getUserSubscription,
} from "@/app/lib/subscriptions";

export async function POST(request: Request) {
  let token;
  try {
    token = await verifyFirebaseIdToken(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const plan = body && typeof body === "object" ? (body as Record<string, unknown>).plan : null;
  if (!isSubscriptionPlan(plan)) {
    return Response.json({ error: "Plan must be pro or business" }, { status: 400 });
  }

  try {
    const current = await getUserSubscription(token.uid);
    if (current?.status === "active") {
      return Response.json({ error: "An active subscription already exists" }, { status: 409 });
    }
    const created = await createRazorpaySubscription(getRazorpayPlanId(plan), token.uid, plan);
    await db.insert(subscriptions).values({
      userId: token.uid,
      plan,
      providerSubscriptionId: created.id,
      status: "pending",
    }).onConflictDoNothing({ target: subscriptions.providerSubscriptionId });

    const persisted = await db.select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, created.id))
      .limit(1);
    if (persisted[0]?.userId !== token.uid) throw new Error("Subscription ownership could not be established.");
    return Response.json({ checkoutUrl: created.checkoutUrl });
  } catch (error) {
    console.error("Subscription checkout failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Unable to start subscription checkout" }, { status: 503 });
  }
}
