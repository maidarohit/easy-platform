"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { BILLING_PLANS, type BillingPlanKey } from "@/app/lib/billing-plans";

type SubscriptionStatus = "pending" | "active" | "past_due" | "cancelled" | "expired";
type BillingStatus = { subscription: { plan: BillingPlanKey; status: SubscriptionStatus; cancelAtPeriodEnd: boolean } | null; entitlements: { paidAccess: boolean } };
const copy: Record<SubscriptionStatus, [string, string]> = {
  pending: ["Waiting for payment confirmation", "Payment setup is in progress. Access unlocks only after verified confirmation."],
  active: ["Subscription active", "Your paid Buzypeezy access is ready."],
  past_due: ["Payment needs attention", "Choose a plan again or contact support."],
  cancelled: ["Subscription cancelled", "Paid access is no longer active."],
  expired: ["Subscription expired", "Choose a plan to restore paid access."],
};

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState<BillingPlanKey | "status" | "cancel" | null>("status");
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const loadStatus = useCallback(async () => {
    const response = await authenticatedFetch("/api/billing/status", { cache: "no-store" });
    const data = await response.json() as BillingStatus & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to load billing status.");
    setStatus(data); return data;
  }, []);
  useEffect(() => {
    let stopped = false;
    const returning = new URLSearchParams(window.location.search).get("checkout") === "return";
    const check = async () => { try { const data = await loadStatus(); if (!stopped && returning && data.subscription?.status === "pending") window.setTimeout(check, 3000); }
      catch (error) { if (!stopped) setMessage(error instanceof Error ? error.message : "Unable to load billing status."); }
      finally { if (!stopped) setLoading(null); } };
    void check(); return () => { stopped = true; };
  }, [loadStatus]);
  async function checkout(plan: BillingPlanKey) {
    setLoading(plan); setMessage("");
    try { const response = await authenticatedFetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? "Unable to start checkout."); window.location.assign(data.checkoutUrl); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start checkout."); setLoading(null); }
  }
  async function cancelSubscription() {
    setLoading("cancel"); setMessage("");
    try { const response = await authenticatedFetch("/api/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error ?? "Unable to request cancellation.");
      setConfirmCancel(false); setMessage("Cancellation requested. Access remains subject to Razorpay confirmation."); await loadStatus(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to request cancellation."); } finally { setLoading(null); }
  }
  const stateCopy = status?.subscription ? copy[status.subscription.status] : null;
  return <main className="min-h-screen bg-[#F7F4EC] px-5 py-16 text-[#1B211E]"><div className="mx-auto max-w-4xl">
    <Link href="/" className="font-semibold text-[#173D32]">← Buzypeezy</Link><h1 className="mt-8 text-4xl font-semibold text-[#0E2C24]">Plans and billing</h1>
    {loading === "status" && <p className="mt-4 text-[#626A64]">Checking your subscription…</p>}
    {stateCopy && <section className="mt-6 rounded-2xl border border-[#173D32]/10 bg-white p-6"><h2 className="text-xl font-semibold text-[#0E2C24]">{stateCopy[0]}</h2><p className="mt-2 text-[#52605A]">{stateCopy[1]}</p>{status?.subscription?.cancelAtPeriodEnd && <p className="mt-3 text-sm font-semibold text-amber-800">Cancellation is scheduled with the payment provider.</p>}</section>}
    {message && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">{message}</p>}
    <div className="mt-10 grid gap-5 md:grid-cols-2">{Object.values(BILLING_PLANS).map((plan) => <section key={plan.key} className="rounded-2xl border border-[#173D32]/10 bg-white p-6"><h2 className="text-2xl font-semibold text-[#0E2C24]">{plan.name}</h2><p className="mt-3 text-lg text-[#52605A]">{plan.displayPrice}{plan.period}</p><p className="mt-3 text-sm leading-6 text-[#626A64]">{plan.description}</p><button disabled={loading !== null || status?.entitlements.paidAccess} onClick={() => checkout(plan.key)} className="mt-8 w-full rounded-xl bg-[#173D32] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading === plan.key ? "Payment setup in progress…" : status?.entitlements.paidAccess ? "Subscription active" : `Choose ${plan.name}`}</button></section>)}</div>
    {status?.subscription?.status === "active" && !status.subscription.cancelAtPeriodEnd && <section className="mt-8 rounded-2xl border border-[#173D32]/10 bg-white p-6"><h2 className="font-semibold text-[#0E2C24]">Manage subscription</h2>{!confirmCancel ? <button onClick={() => setConfirmCancel(true)} className="mt-4 rounded-xl border border-red-800 px-4 py-2 font-semibold text-red-800">Cancel subscription</button> : <div className="mt-4"><p className="text-sm text-[#52605A]">Confirm that you want cancellation scheduled through Razorpay.</p><div className="mt-3 flex gap-3"><button disabled={loading !== null} onClick={() => void cancelSubscription()} className="rounded-xl bg-red-800 px-4 py-2 font-semibold text-white">Confirm cancellation</button><button onClick={() => setConfirmCancel(false)} className="rounded-xl border px-4 py-2">Keep subscription</button></div></div>}</section>}
    <p className="mt-8 text-center text-sm text-[#626A64]">Need help? <a href="mailto:support@buzypeezy.ai" className="font-semibold text-[#173D32] underline">Contact support</a></p>
  </div></main>;
}
