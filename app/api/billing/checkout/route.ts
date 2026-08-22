import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import { isSubscriptionPlan, type SubscriptionPlan } from "@/app/lib/subscription-policy";
import {
  createRazorpaySubscription,
  getRazorpayPlanId,
  getUserSubscription,
} from "@/app/lib/subscriptions";

const MAX_CHECKOUT_BODY_BYTES = 2 * 1024;

export function validateCheckoutBody(body: unknown): SubscriptionPlan | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || !("plan" in value)) return null;

  return isSubscriptionPlan(value.plan) ? value.plan : null;
}

export async function POST(request: Request) {
  let token;
  try {
    token = await verifyFirebaseIdToken(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_CHECKOUT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large" }, { status: 413 });
    }
    if (!(error instanceof MalformedJsonBodyError)) throw error;
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const plan = validateCheckoutBody(body);
  if (!plan) {
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
