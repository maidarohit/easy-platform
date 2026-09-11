import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { getUserEntitlements, getUserSubscription } from "@/app/lib/subscriptions";
import { getSafeBillingDiagnostics } from "@/app/lib/billing-configuration";
import { getBusinessPlanUsageSnapshot } from "@/app/lib/business-plan-usage";
import { hasPaidProductAccess } from "@/app/lib/paid-entitlements";
import { BILLING_PLAN } from "@/app/lib/billing-plans";
import { billingMarketFromHeaders } from "@/app/lib/billing-market";

export async function GET(request: Request) {
  let token;
  try {
    token = await verifyFirebaseIdToken(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [subscription, entitlements, paidAccess, usage] = await Promise.all([
    getUserSubscription(token.uid),
    getUserEntitlements(token.uid),
    hasPaidProductAccess(token.uid),
    getBusinessPlanUsageSnapshot(token.uid),
  ]);
  const market = billingMarketFromHeaders(request.headers);
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
    usage: usage ? {
      resetAt: usage.resetAt,
      workspace: usage.workspace,
      aiThisMonth: usage.aiThisMonth,
      notifications: usage.notifications.map((notification) => ({
        id: notification.id,
        category: notification.category,
        featureLabel: notification.featureLabel,
        threshold: notification.threshold,
        message: notification.message,
        remaining: notification.remaining,
        resetAt: notification.resetAt,
        createdAt: notification.createdAt,
      })),
    } : null,
  });
}
