import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { getUserEntitlements, getUserSubscription } from "@/app/lib/subscriptions";
import { getSafeBillingDiagnostics } from "@/app/lib/billing-configuration";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";
import { BILLING_PLAN, marketForCountry } from "@/app/lib/billing-plans";

export async function GET(request: Request) {
  let token;
  try {
    token = await verifyFirebaseIdToken(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [subscription, entitlements, paidAccess] = await Promise.all([
    getUserSubscription(token.uid),
    getUserEntitlements(token.uid),
    hasPaidProductAccess(token.uid),
  ]);
  const market = marketForCountry(request.headers.get("x-vercel-ip-country"));
  return Response.json({
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } : null,
    entitlements: {
      ...entitlements,
      subscriptionPaidAccess: entitlements.paidAccess,
      paidAccess,
    },
    billingConfiguration: getSafeBillingDiagnostics(),
    offer: { market, ...BILLING_PLAN.prices[market] },
  });
}
