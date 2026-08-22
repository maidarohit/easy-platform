import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { readLimitedRawBody, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { statusForRazorpayEvent } from "@/app/lib/subscription-policy";
import { verifyRazorpayWebhook } from "@/app/lib/razorpay-webhook";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function unixDate(value: unknown): Date | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });

  let rawBody: Buffer;
  try {
    rawBody = await readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!verifyRazorpayWebhook(rawBody, request.headers.get("x-razorpay-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!event || typeof event !== "object") return Response.json({ received: true });
  const root = event as Record<string, unknown>;
  const eventName = typeof root.event === "string" ? root.event : "";
  const status = statusForRazorpayEvent(eventName);
  if (!status) return Response.json({ received: true });

  const payload = root.payload && typeof root.payload === "object" ? root.payload as Record<string, unknown> : {};
  const wrapper = payload.subscription && typeof payload.subscription === "object"
    ? payload.subscription as Record<string, unknown>
    : {};
  const entity = wrapper.entity && typeof wrapper.entity === "object"
    ? wrapper.entity as Record<string, unknown>
    : {};
  const providerSubscriptionId = typeof entity.id === "string" ? entity.id : null;
  if (!providerSubscriptionId) return Response.json({ received: true });

  const subscriptionMatch = eq(
    subscriptions.providerSubscriptionId,
    providerSubscriptionId
  );
  const updateMatch = status === "cancelled" || status === "expired"
    ? subscriptionMatch
    : and(
        subscriptionMatch,
        notInArray(subscriptions.status, ["cancelled", "expired"])
      );

  await db.update(subscriptions).set({
    status,
    providerCustomerId: typeof entity.customer_id === "string" ? entity.customer_id : null,
    currentPeriodStart: unixDate(entity.current_start),
    currentPeriodEnd: unixDate(entity.current_end),
    cancelAtPeriodEnd: entity.cancel_at_cycle_end === true || entity.cancel_at_cycle_end === 1,
    updatedAt: new Date(),
  }).where(updateMatch);

  return Response.json({ received: true });
}
