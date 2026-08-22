"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type Plan = "pro" | "business";
type BillingStatus = { subscription: { plan: Plan; status: string } | null; entitlements: { paidAccess: boolean } };
const planNames: Record<Plan, string> = { pro: "Starter", business: "Growth" };
const plans: Array<{ plan: Plan; name: string; price: string }> = [
  { plan: "pro", name: planNames.pro, price: "₹1,999/month" },
  { plan: "business", name: planNames.business, price: "₹4,999/month" },
];

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState<Plan | "status" | null>("status");
  const [message, setMessage] = useState("");

  useEffect(() => {
    authenticatedFetch("/api/billing/status")
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Log in to manage billing." : "Unable to load billing status.");
        setStatus(await response.json() as BillingStatus);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load billing status."))
      .finally(() => setLoading(null));
  }, []);

  async function checkout(plan: Plan) {
    setLoading(plan);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error ?? "Unable to start checkout.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout.");
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F4EC] px-5 py-16 text-[#1B211E]">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="font-semibold text-[#173D32]">← Buzypeezy</Link>
        <h1 className="mt-8 text-4xl font-semibold text-[#0E2C24]">Plans and billing</h1>
        {loading === "status" && <p className="mt-4 text-[#626A64]">Loading subscription status…</p>}
        {status?.subscription && <p className="mt-4 rounded-xl bg-white p-4 text-[#46514B]">Current plan: <strong>{planNames[status.subscription.plan]}</strong> · {status.subscription.status.replace("_", " ")}</p>}
        {message && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{message} <Link className="underline" href="/login">Log in</Link></p>}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {plans.map(({ plan, name, price }) => <section key={plan} className="rounded-2xl border border-[#173D32]/10 bg-white p-6"><h2 className="text-2xl font-semibold text-[#0E2C24]">{name}</h2><p className="mt-3 text-lg text-[#52605A]">{price}</p><button disabled={loading !== null || status?.entitlements.paidAccess} onClick={() => checkout(plan)} className="mt-8 w-full rounded-xl bg-[#173D32] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading === plan ? "Opening checkout…" : status?.entitlements.paidAccess ? "Subscription active" : `Choose ${name}`}</button></section>)}
        </div>
        <p className="mt-8 text-center text-sm text-[#626A64]">Billing support: <a href="mailto:support@buzypeezy.ai" className="font-semibold text-[#173D32] underline">support@buzypeezy.ai</a></p>
      </div>
    </main>
  );
}
