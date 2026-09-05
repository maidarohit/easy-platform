import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import { isSubscriptionPlan, type SubscriptionPlan } from "@/app/lib/subscription-policy";
import { marketForCountry } from "@/app/lib/billing-plans";
import {
  createRazorpaySubscription,
  getRazorpayPlanId,
  RazorpaySubscriptionCreationRejectedError,
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
    return Response.json({ error: "Plan must be business" }, { status: 400 });
  }

  const market = marketForCountry(request.headers.get("x-vercel-ip-country"));
  const providerPlanId = getRazorpayPlanId(market);
  if (!providerPlanId) {
    return Response.json(
      { error: "International payments are opening shortly. Please check back soon." },
      { status: 503 },
    );
  }

  try {
    const reservationId = `checkout_intent_${randomUUID()}`;
    const reservation = await db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`billing-checkout:${token.uid}`}))`);
      const [current] = await transaction.select().from(subscriptions)
        .where(eq(subscriptions.userId, token.uid))
        .orderBy(desc(subscriptions.updatedAt)).limit(1);
      if (current?.status === "active") return { error: "Plan changes are not available yet." } as const;
      const recentPending = current?.status === "pending" && current.createdAt >= new Date(Date.now() - 30 * 60 * 1000);
      const unresolvedReservation = current?.status === "pending" && current.providerSubscriptionId.startsWith("checkout_intent_");
      if (recentPending || unresolvedReservation) return { error: current.plan === plan
        ? "Payment setup is already in progress. Return to billing or contact support."
        : "Another payment setup is already in progress." } as const;
      await transaction.insert(subscriptions).values({ userId: token.uid, plan, providerSubscriptionId: reservationId, status: "pending" });
      return { reserved: true } as const;
    });
    if ("error" in reservation) return Response.json({ error: reservation.error }, { status: 409 });

    let created: Awaited<ReturnType<typeof createRazorpaySubscription>>;
    try {
      created = await createRazorpaySubscription(providerPlanId, token.uid, plan, market);
    } catch (error) {
      if (error instanceof RazorpaySubscriptionCreationRejectedError) {
        const released = await db.delete(subscriptions).where(and(
          eq(subscriptions.userId, token.uid),
          eq(subscriptions.providerSubscriptionId, reservationId),
          eq(subscriptions.status, "pending"),
        )).returning({ id: subscriptions.id });
        console.error("Razorpay definitively rejected subscription creation:", {
          userId: token.uid,
          reservationId,
          status: error.status,
          description: error.description,
          reservationReleased: released.length === 1,
        });
      }
      throw error;
    }
    try {
      await db.update(subscriptions).set({ providerSubscriptionId: created.id, updatedAt: new Date() })
        .where(and(eq(subscriptions.userId, token.uid), eq(subscriptions.providerSubscriptionId, reservationId)));

      const persisted = await db.select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.providerSubscriptionId, created.id))
        .limit(1);
      if (persisted[0]?.userId !== token.uid) throw new Error("Subscription ownership could not be established.");
    } catch (error) {
      console.error("Razorpay subscription created but persistence failed; reconciliation required:", {
        userId: token.uid,
        reservationId,
        providerSubscriptionId: created.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
    return Response.json({ checkoutUrl: created.checkoutUrl, returnUrl: "/billing?checkout=return" });
  } catch (error) {
    console.error("Subscription checkout failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Unable to start subscription checkout" }, { status: 503 });
  }
}
