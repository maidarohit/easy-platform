import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/app/db";
import {
  razorpayWebhookEvents,
  subscriptions,
  type RazorpayWebhookEventOutcome,
  type SubscriptionStatus,
} from "@/app/db/schema";
import { readLimitedRawBody, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { statusForRazorpayEvent } from "@/app/lib/subscription-policy";
import { verifyRazorpayWebhook } from "@/app/lib/razorpay-webhook";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const MAX_PROVIDER_EVENT_ID_LENGTH = 200;
const MAX_PROVIDER_SUBSCRIPTION_ID_LENGTH = 200;
const MAX_EVENT_TYPE_LENGTH = 100;
const MAX_UNIX_TIMESTAMP = 253_402_300_799;

class UnknownSubscriptionError extends Error {}

type ValidatedSubscriptionEvent = {
  eventName: string;
  providerCreatedAt: Date;
  providerEventId: string;
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  entity: Record<string, unknown>;
};

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export function validateSupportedSubscriptionEvent(
  root: Record<string, unknown>,
  providerEventId: string | null,
): ValidatedSubscriptionEvent | null {
  const eventName = root.event;
  if (!isBoundedNonEmptyString(eventName, MAX_EVENT_TYPE_LENGTH)) return null;

  const status = statusForRazorpayEvent(eventName);
  if (!status) return null;
  if (!isBoundedNonEmptyString(providerEventId, MAX_PROVIDER_EVENT_ID_LENGTH)) {
    throw new TypeError("Invalid provider event ID");
  }

  const createdAt = root.created_at;
  if (
    typeof createdAt !== "number" ||
    !Number.isSafeInteger(createdAt) ||
    createdAt <= 0 ||
    createdAt > MAX_UNIX_TIMESTAMP
  ) {
    throw new TypeError("Invalid provider event timestamp");
  }

  const payload = root.payload && typeof root.payload === "object" && !Array.isArray(root.payload)
    ? root.payload as Record<string, unknown>
    : null;
  const wrapper = payload?.subscription && typeof payload.subscription === "object" && !Array.isArray(payload.subscription)
    ? payload.subscription as Record<string, unknown>
    : null;
  const entity = wrapper?.entity && typeof wrapper.entity === "object" && !Array.isArray(wrapper.entity)
    ? wrapper.entity as Record<string, unknown>
    : null;
  const providerSubscriptionId = entity?.id;
  if (!entity || !isBoundedNonEmptyString(providerSubscriptionId, MAX_PROVIDER_SUBSCRIPTION_ID_LENGTH)) {
    throw new TypeError("Invalid subscription event structure");
  }

  return {
    eventName,
    providerCreatedAt: new Date(createdAt * 1000),
    providerEventId,
    providerSubscriptionId,
    status,
    entity,
  };
}

export function subscriptionEventOutcome(
  currentStatus: SubscriptionStatus,
  incomingStatus: SubscriptionStatus,
  providerCreatedAt: Date,
  latestProcessedAt: Date | null,
): RazorpayWebhookEventOutcome {
  if (latestProcessedAt && providerCreatedAt < latestProcessedAt) return "ignored_stale";

  const currentIsTerminal = currentStatus === "cancelled" || currentStatus === "expired";
  const incomingIsTerminal = incomingStatus === "cancelled" || incomingStatus === "expired";
  if (currentIsTerminal && !incomingIsTerminal) return "ignored_terminal";
  if (
    currentIsTerminal &&
    incomingIsTerminal &&
    latestProcessedAt &&
    providerCreatedAt.getTime() === latestProcessedAt.getTime()
  ) {
    return "ignored_terminal";
  }
  return "processed";
}

export async function processValidatedSubscriptionEvent(
  validated: ValidatedSubscriptionEvent,
  database: Pick<typeof db, "transaction"> = db,
) {
  return database.transaction(async (tx) => {
    const reserved = await tx
      .insert(razorpayWebhookEvents)
      .values({
        providerEventId: validated.providerEventId,
        eventType: validated.eventName,
        providerSubscriptionId: validated.providerSubscriptionId,
        providerCreatedAt: validated.providerCreatedAt,
      })
      .onConflictDoNothing({ target: razorpayWebhookEvents.providerEventId })
      .returning({ providerEventId: razorpayWebhookEvents.providerEventId });

    if (reserved.length === 0) return "duplicate" as const;

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${validated.providerSubscriptionId}, 0))`,
    );

    const [subscription] = await tx
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, validated.providerSubscriptionId))
      .limit(1);
    if (!subscription) throw new UnknownSubscriptionError();

    const [latest] = await tx
      .select({ providerCreatedAt: razorpayWebhookEvents.providerCreatedAt })
      .from(razorpayWebhookEvents)
      .where(
        and(
          eq(
            razorpayWebhookEvents.providerSubscriptionId,
            validated.providerSubscriptionId,
          ),
          isNotNull(razorpayWebhookEvents.processedAt),
        ),
      )
      .orderBy(desc(razorpayWebhookEvents.providerCreatedAt))
      .limit(1);

    const outcome = subscriptionEventOutcome(
      subscription.status,
      validated.status,
      validated.providerCreatedAt,
      latest?.providerCreatedAt ?? null,
    );

    if (outcome === "processed") {
      await tx
        .update(subscriptions)
        .set({
          status: validated.status,
          providerCustomerId: typeof validated.entity.customer_id === "string"
            ? validated.entity.customer_id
            : null,
          currentPeriodStart: unixDate(validated.entity.current_start),
          currentPeriodEnd: unixDate(validated.entity.current_end),
          cancelAtPeriodEnd:
            validated.entity.cancel_at_cycle_end === true ||
            validated.entity.cancel_at_cycle_end === 1,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.providerSubscriptionId, validated.providerSubscriptionId));
    }

    await tx
      .update(razorpayWebhookEvents)
      .set({ outcome, processedAt: new Date() })
      .where(eq(razorpayWebhookEvents.providerEventId, validated.providerEventId));

    return outcome;
  });
}

function unixDate(value: unknown): Date | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

export async function POST(request: Request) {
  let rawBody: Buffer;
  try {
    rawBody = await readLimitedRawBody(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ error: "Request body is too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook unavailable" }, { status: 503 });

  if (!verifyRazorpayWebhook(rawBody, request.headers.get("x-razorpay-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const root = event as Record<string, unknown>;
  let validated: ValidatedSubscriptionEvent | null;
  try {
    validated = validateSupportedSubscriptionEvent(
      root,
      request.headers.get("x-razorpay-event-id"),
    );
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!validated) return Response.json({ received: true });

  try {
    const result = await processValidatedSubscriptionEvent(validated);

    if (result === "duplicate") {
      return Response.json({ received: true, duplicate: true });
    }
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Webhook processing unavailable" }, { status: 503 });
  }
}
