"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { BILLING_PLAN, type BillingPlanKey } from "@/app/lib/billing-plans";

type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";
type BillingStatus = {
  subscription: {
    plan: string;
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd?: string | null;
  } | null;
  entitlements: {
    paidAccess: boolean;
    subscriptionPaidAccess: boolean;
  };
  offer: { market: "india" | "international"; displayPrice: string; taxLabel: string; currency: "INR" | "USD"; amountMinor: number };
  usage: {
    resetAt: string | null;
    workspace: {
      key: string;
      label: string;
      used: number;
      limit: number;
      remaining: number;
    }[];
    aiThisMonth: {
      key: string;
      label: string;
      detail: string | null;
      used: number;
      limit: number;
      remaining: number;
      percentageUsed: number;
    }[];
    notifications: {
      id: string;
      featureLabel: string;
      threshold: 50 | 80 | 100;
      message: string;
      remaining: number;
      resetAt: string | null;
      createdAt: string;
    }[];
  } | null;
};
type BillingOffer = BillingStatus["offer"];
const copy: Record<SubscriptionStatus, [string, string]> = {
  pending: [
    "Waiting for payment confirmation",
    "Payment setup is in progress. Access unlocks only after verified confirmation.",
  ],
  active: ["Subscription active", "Your paid Buzypeezy access is ready."],
  past_due: [
    "Payment needs attention",
    "Choose a plan again or contact support.",
  ],
  cancelled: ["Subscription cancelled", "Paid access is no longer active."],
  expired: ["Subscription expired", "Choose a plan to restore paid access."],
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resolveReturnTo() {
  if (typeof window === "undefined") return "/dashboard";
  const parameters = new URLSearchParams(window.location.search);
  const requestedReturn = parameters.get("returnTo");
  return requestedReturn?.startsWith("/") && !requestedReturn.startsWith("//")
    ? requestedReturn
    : sessionStorage.getItem("billing-return-to") || "/dashboard";
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [offer, setOffer] = useState<BillingOffer | null>(null);
  const [loading, setLoading] = useState<
    BillingPlanKey | "status" | "cancel" | null
  >("status");
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanKey | null>(null);
  const loadStatus = useCallback(async () => {
    const response = await authenticatedFetch("/api/billing/status", {
      cache: "no-store",
    });
    const data = (await response.json()) as BillingStatus & { error?: string };
    if (!response.ok)
      throw new Error(data.error ?? "Unable to load billing status.");
    setStatus(data);
    return data;
  }, []);
  useEffect(() => {
    let stopped = false;
    const parameters = new URLSearchParams(window.location.search);
    const returning = parameters.get("checkout") === "return";
    const check = async () => {
      try {
        const offerResponse = await fetch("/api/billing/offer", { cache: "no-store" });
        if (!offerResponse.ok) throw new Error("Unable to load regional pricing.");
        if (!stopped) setOffer(await offerResponse.json() as BillingOffer);
        const data = await loadStatus();
        if (!stopped) setOffer(data.offer);
        if (!stopped && returning && data.subscription?.status === "pending")
          window.setTimeout(check, 3000);
      } catch (error) {
        if (!stopped) {
          const detail =
            error instanceof Error
              ? error.message
              : "Unable to load billing status.";
          setAuthRequired(detail === "Authentication is required.");
          const requestedPlan = parameters.get("plan");
          if (requestedPlan === "business") setSelectedPlan(requestedPlan);
          setMessage(detail);
        }
      } finally {
        if (!stopped) setLoading(null);
      }
    };
    void check();
    return () => {
      stopped = true;
    };
  }, [loadStatus]);
  async function checkout(plan: BillingPlanKey) {
    setLoading(plan);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.checkoutUrl)
        throw new Error(data.error ?? "Unable to start checkout.");
      sessionStorage.setItem("billing-return-to", returnTo);
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to start checkout.",
      );
      setLoading(null);
    }
  }
  async function cancelSubscription() {
    setLoading("cancel");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "Unable to request cancellation.");
      setConfirmCancel(false);
      setMessage(
        "Cancellation requested. Access remains subject to Razorpay confirmation.",
      );
      await loadStatus();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request cancellation.",
      );
    } finally {
      setLoading(null);
    }
  }
  const stateCopy = status?.subscription
    ? copy[status.subscription.status]
    : null;
  const hasActiveSubscription = status?.subscription?.status === "active";
  const activePlan = status?.subscription?.status === "active"
    ? status.subscription.plan
    : null;
  const returnTo = resolveReturnTo();
  const billingReturn = selectedPlan ? `/billing?plan=${selectedPlan}` : "/billing";
  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-16 text-[#1B211E]">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="font-semibold text-[#173D32]">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-8 text-4xl font-semibold text-[#0E2C24]">
          Plans and billing
        </h1>
        {loading === "status" && (
          <p className="mt-4 text-[#626A64]">Checking your subscription…</p>
        )}
        {stateCopy && (
          <section className="mt-6 rounded-2xl border border-[#173D32]/10 bg-white p-6">
            <h2 className="text-xl font-semibold text-[#0E2C24]">
              {stateCopy[0]}
            </h2>
            <p className="mt-2 text-[#52605A]">{stateCopy[1]}</p>
            {hasActiveSubscription && <Link href={returnTo} className="mt-4 inline-flex rounded-xl bg-[#173D32] px-4 py-2 font-semibold text-white">Continue to my business</Link>}
            {status?.subscription?.cancelAtPeriodEnd && (
              <p className="mt-3 text-sm font-semibold text-amber-800">
                Cancellation is scheduled with the payment provider.
              </p>
            )}
          </section>
        )}
        {status && !status.subscription && (
          <section className="mt-6 rounded-2xl border border-[#173D32]/10 bg-white p-6">
            <h2 className="text-xl font-semibold text-[#0E2C24]">Not subscribed</h2>
            <p className="mt-2 text-[#52605A]">Subscribe to Buzypeezy Business when you are ready.</p>
          </section>
        )}
        {message && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900"
          >
            <p>{message}</p>
            {authRequired && (
              <div className="mt-3 flex flex-wrap gap-4">
                <Link className="font-semibold underline" href={`/login?next=${encodeURIComponent(billingReturn)}`}>Log in to continue</Link>
                <Link className="font-semibold underline" href={`/signup?next=${encodeURIComponent(billingReturn)}`}>Create an account</Link>
              </div>
            )}
          </div>
        )}
        {status?.usage && hasActiveSubscription && (
          <>
            <section className="mt-8 rounded-2xl border border-[#173D32]/10 bg-white p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#0E2C24]">
                    Plan limits
                  </h2>
                  <p className="mt-2 text-[#52605A]">
                    Billing period resets on {formatDate(status.usage.resetAt)}.
                  </p>
                </div>
                <p className="text-sm font-medium text-[#626A64]">
                  One business plan, one business workspace.
                </p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {status.usage.workspace.map((item) => (
                  <article key={item.key} className="rounded-2xl border border-[#173D32]/10 bg-[#F7F4EC] p-4">
                    <p className="text-sm font-semibold text-[#0E2C24]">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[#173D32]">{item.used} / {item.limit}</p>
                    <p className="mt-1 text-sm text-[#626A64]">{item.remaining} remaining</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-[#173D32]/10 bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#0E2C24]">
                    AI Usage This Month
                  </h2>
                  <p className="mt-2 text-[#52605A]">
                    Customer-friendly usage counters without token details.
                  </p>
                </div>
                <p className="text-sm text-[#626A64]">
                  Reset date: {formatDate(status.usage.resetAt)}
                </p>
              </div>
              <div className="mt-6 space-y-4">
                {status.usage.aiThisMonth.map((item) => (
                  <article key={item.key} className="rounded-2xl border border-[#173D32]/10 bg-[#FCFBF7] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#0E2C24]">
                          {item.label}
                          {item.detail ? ` ${item.detail}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[#626A64]">
                          {item.used} / {item.limit} used
                        </p>
                      </div>
                      <div className="text-sm text-[#173D32]">
                        <p className="font-semibold">{item.remaining} remaining</p>
                        <p className="text-[#626A64]">{item.percentageUsed}% used</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E7E2D7]">
                      <div
                        className="h-full rounded-full bg-[#173D32]"
                        style={{ width: `${Math.min(item.percentageUsed, 100)}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {status.usage.notifications.length > 0 && (
              <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="text-xl font-semibold text-amber-900">
                  Usage notifications
                </h2>
                <div className="mt-4 space-y-3">
                  {status.usage.notifications.map((notification) => (
                    <article key={notification.id} className="rounded-xl border border-amber-200 bg-white p-4 text-amber-950">
                      <p className="text-sm font-semibold">
                        {notification.featureLabel} · {notification.threshold}%
                      </p>
                      <p className="mt-1 text-sm">{notification.message}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <div className="mx-auto mt-10 grid max-w-xl gap-5">
          {[BILLING_PLAN].map((plan) => (
            <section
              key={plan.key}
              className={`rounded-2xl border bg-white p-6 ${selectedPlan === plan.key ? "border-[#173D32] ring-2 ring-[#A8B8A7]" : "border-[#173D32]/10"}`}
            >
              <h2 className="text-2xl font-semibold text-[#0E2C24]">
                {plan.name}
              </h2>
              <p className="mt-3 text-lg text-[#52605A]">
                {offer?.displayPrice ?? "Loading price…"}
                {plan.period}
              </p>
              {offer && <p className="mt-1 text-sm text-[#626A64]">+ {offer.taxLabel}</p>}
              <p className="mt-3 text-sm leading-6 text-[#626A64]">
                {plan.description}
              </p>
              <button
                disabled={loading !== null || hasActiveSubscription}
                onClick={() => checkout(plan.key)}
                className="mt-8 w-full rounded-xl bg-[#173D32] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === plan.key
                  ? "Payment setup in progress…"
                  : activePlan === plan.key
                    ? "Subscription active"
                    : `Choose ${plan.name}`}
              </button>
            </section>
          ))}
        </div>
        {status?.subscription?.status === "active" &&
          !status.subscription.cancelAtPeriodEnd && (
            <section className="mt-8 rounded-2xl border border-[#173D32]/10 bg-white p-6">
              <h2 className="font-semibold text-[#0E2C24]">
                Manage subscription
              </h2>
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="mt-4 rounded-xl border border-red-800 px-4 py-2 font-semibold text-red-800"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-[#52605A]">
                    Confirm that you want cancellation scheduled through
                    Razorpay.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      disabled={loading !== null}
                      onClick={() => void cancelSubscription()}
                      className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white"
                    >
                      Confirm cancellation
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="rounded-xl border px-4 py-2"
                    >
                      Keep subscription
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        <p className="mt-8 text-center text-sm text-[#626A64]">
          Need help?{" "}
          <a
            href="mailto:support@buzypeezy.ai"
            className="font-semibold text-[#173D32] underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}
