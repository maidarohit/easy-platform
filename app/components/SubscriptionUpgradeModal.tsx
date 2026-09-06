"use client";

import { useEffect, useMemo, useState } from "react";
import { BILLING_PLAN } from "@/app/lib/billing-plans";
import { SUBSCRIPTION_REQUIRED_EVENT, type SubscriptionRequiredDetail } from "@/app/lib/subscription-required";

type BillingOffer = { displayPrice: string; taxLabel: string };

export default function SubscriptionUpgradeModal() {
  const [detail, setDetail] = useState<SubscriptionRequiredDetail | null>(null);
  const [offer, setOffer] = useState<BillingOffer | null>(null);

  useEffect(() => {
    const open = (event: Event) => setDetail((event as CustomEvent<SubscriptionRequiredDetail>).detail);
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, open);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, open);
  }, []);

  useEffect(() => {
    if (!detail || offer) return;
    let active = true;
    void fetch("/api/billing/offer", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("offer unavailable");
        const value = await response.json() as BillingOffer;
        if (active) setOffer(value);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [detail, offer]);

  const billingHref = useMemo(() => {
    if (!detail) return "/billing?plan=business";
    const params = new URLSearchParams({ plan: "business", returnTo: detail.returnTo });
    if (detail.projectId) params.set("projectId", detail.projectId);
    return `/billing?${params.toString()}`;
  }, [detail]);

  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0E2C24]/70 p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="subscription-upgrade-title" className="w-full max-w-lg rounded-[24px] border border-[#D8DCCF] bg-[#FCFBF7] p-6 text-[#1B211E] shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#60756C]">{BILLING_PLAN.name}</p>
        <h2 id="subscription-upgrade-title" className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#173D32]">Continue with Buzypeezy Business</h2>
        <p className="mt-4 leading-7 text-[#52605A]">Your free website preview is ready. Subscribe to unlock publishing, AI tools, website edits and your full business workspace.</p>
        {offer && <p className="mt-5 text-lg font-semibold text-[#173D32]">{offer.displayPrice}{BILLING_PLAN.period} <span className="text-sm font-normal text-[#626A64]">+ {offer.taxLabel}</span></p>}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <a href={billingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#173D32] px-5 font-semibold text-white">Subscribe &amp; Continue</a>
          <button type="button" onClick={() => setDetail(null)} className="min-h-12 rounded-xl border border-[#A8B8A7] px-5 font-semibold text-[#173D32]">Keep viewing my preview</button>
        </div>
      </section>
    </div>
  );
}
