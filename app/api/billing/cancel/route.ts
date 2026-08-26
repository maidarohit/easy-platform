import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { cancelRazorpaySubscription, getUserSubscription } from "@/app/lib/subscriptions";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

const MAX_CANCEL_BODY_BYTES = 1024;

export async function POST(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: "Authentication is required" }, { status: 401 }); }

  let body: unknown;
  try { body = await readLimitedJson(request, MAX_CANCEL_BODY_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request body is too large" }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    return Response.json({ error: "Unable to read cancellation request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || (body as Record<string, unknown>).confirm !== true) {
    return Response.json({ error: "Cancellation confirmation is required" }, { status: 400 });
  }

  const subscription = await getUserSubscription(uid);
  if (!subscription || subscription.status !== "active") return Response.json({ error: "No active subscription was found" }, { status: 409 });
  if (subscription.providerSubscriptionId.startsWith("checkout_intent_")) return Response.json({ error: "Payment setup is still in progress" }, { status: 409 });

  try {
    await cancelRazorpaySubscription(subscription.providerSubscriptionId);
    await db.update(subscriptions).set({ cancelAtPeriodEnd: true, updatedAt: new Date() }).where(eq(subscriptions.id, subscription.id));
    return Response.json({ cancellationRequested: true, status: subscription.status });
  } catch {
    return Response.json({ error: "Unable to request cancellation. Please contact support." }, { status: 503 });
  }
}
