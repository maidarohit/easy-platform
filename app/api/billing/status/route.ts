import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { getUserEntitlements, getUserSubscription } from "@/app/lib/subscriptions";

export async function GET(request: Request) {
  let token;
  try {
    token = await verifyFirebaseIdToken(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [subscription, entitlements] = await Promise.all([
    getUserSubscription(token.uid),
    getUserEntitlements(token.uid),
  ]);
  return Response.json({
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } : null,
    entitlements,
  });
}
