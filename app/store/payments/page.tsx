"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_TYPES,
  INDIAN_STATES,
} from "@/app/lib/merchant-payment-options";

type PaymentState = Readonly<{
  uiState: "not_connected" | "setup_in_progress" | "under_review" | "active" | "needs_action" | "unavailable";
  onboardingStatus: string;
  nextStep: "business" | "stakeholder" | "product" | "settlements" | "verification" | "done" | "unavailable";
  customerMessage: string | null;
  verificationUrl: string | null;
}>;

function PaymentsContent() {
  const projectId = useSearchParams().get("projectId")?.trim() ?? "";
  const projectLink = (path: string) =>
    projectId ? `${path}?projectId=${encodeURIComponent(projectId)}` : path;

  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [customerFacingBusinessName, setCustomerFacingBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [businessType, setBusinessType] = useState("proprietorship");
  const [category, setCategory] = useState("services");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("KARNATAKA");
  const [postalCode, setPostalCode] = useState("");

  const [stakeholderName, setStakeholderName] = useState("");
  const [stakeholderEmail, setStakeholderEmail] = useState("");
  const [stakeholderPhone, setStakeholderPhone] = useState("");
  const [tncAccepted, setTncAccepted] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");

  async function loadStatus(refresh = false) {
    const response = await authenticatedFetch(
      `/api/store/payments/status?projectId=${encodeURIComponent(projectId)}${refresh ? "&refresh=1" : ""}`,
      { cache: "no-store" },
    );
    const data = await response.json() as { payment?: PaymentState; error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to load payment setup.");
    if (data.payment) setPayment(data.payment);
  }

  useEffect(() => {
    let active = true;
    if (!projectId) {
      queueMicrotask(() => {
        if (!active) return;
        setError("Open this page from a business to set up payments.");
        setLoading(false);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => { if (active) { setLoading(true); setError(""); } });
    void authenticatedFetch(
      `/api/store/payments/status?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    ).then(async (response) => {
      const data = await response.json() as { payment?: PaymentState; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load payment setup.");
      if (active && data.payment) setPayment(data.payment);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Unable to load payment setup.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  async function postJson(path: string, body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as {
        payment?: PaymentState;
        error?: string;
        provider?: {
          status?: number;
          code?: string | null;
          description?: string | null;
          field?: string | null;
          source?: string | null;
          step?: string | null;
          reason?: string | null;
        };
      };
      if (!response.ok) {
        const provider = data.provider;
        const localDetail = provider
          ? [
            provider.status ? `HTTP ${provider.status}` : null,
            provider.code,
            provider.description,
            provider.field ? `field: ${provider.field}` : null,
            provider.source ? `source: ${provider.source}` : null,
            provider.step ? `step: ${provider.step}` : null,
            provider.reason ? `reason: ${provider.reason}` : null,
          ].filter(Boolean).join(" — ")
          : "";
        throw new Error([data.error || data.payment?.customerMessage, localDetail].filter(Boolean).join(" — ") || "Unable to continue setup.");
      }
      if (data.payment) setPayment(data.payment);
      setAccountNumber("");
      setIfscCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue setup.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBusiness(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/store/payments/onboard", {
      projectId, legalBusinessName, customerFacingBusinessName, email, phone, contactName,
      businessType, category, street1, street2, city, state, postalCode,
    });
  }

  async function submitStakeholder(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/store/payments/stakeholder", {
      projectId,
      name: stakeholderName,
      email: stakeholderEmail,
      phone: stakeholderPhone,
    });
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/store/payments/product", { projectId, tncAccepted });
  }

  async function submitSettlements(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/store/payments/settlements", { projectId, accountNumber, ifscCode, beneficiaryName });
  }

  async function continueVerification() {
    setSaving(true);
    setError("");
    try {
      await loadStatus(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh verification.");
    } finally {
      setSaving(false);
    }
  }

  const step = payment?.nextStep ?? "business";

  return (
    <main className="min-h-screen bg-[#F7F3E9] px-6 py-10 text-[#103C32]">
      <div className="mx-auto max-w-3xl">
        <Link href={projectLink("/store")} className="text-sm font-semibold">← Store & Products</Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C32]">Accept Payments</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">Payment setup</h1>
        <p className="mt-3 text-sm leading-6 text-[#66716B]">
          Set up payments for this business. This is separate from your Buzypeezy subscription.
          Customer checkout charges are not taken during this setup.
        </p>
        {loading && <p className="mt-6 text-sm text-[#66716B]">Loading payment setup…</p>}
        {error && <p role="status" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {payment?.customerMessage && payment.uiState !== "unavailable" && (
          <p className="mt-6 rounded-xl border border-[#E6D7A8] bg-[#FFF8E7] p-4 text-sm text-[#7A5C20]">{payment.customerMessage}</p>
        )}
        {payment?.uiState === "unavailable" && (
          <p className="mt-6 rounded-xl border border-[#E6D7A8] bg-[#FFF8E7] p-4 text-sm text-[#7A5C20]">
            Payment onboarding is not available yet. Please contact Buzypeezy support.
          </p>
        )}
        {payment?.uiState === "active" && (
          <p className="mt-6 rounded-xl border border-[#C9D9C6] bg-[#F3F7F1] p-4 text-sm font-semibold">Payments Active</p>
        )}
        {payment?.uiState === "under_review" && (
          <p className="mt-6 rounded-xl border border-[#DED6C3] bg-white p-4 text-sm">Razorpay verification in progress</p>
        )}

        {!loading && projectId && step === "business" && payment?.uiState !== "unavailable" && (
          <form onSubmit={(event) => void submitBusiness(event)} className="mt-8 grid gap-4 rounded-[28px] border border-[#DED6C3] bg-white p-8">
            <h2 className="text-2xl font-semibold">Step 1 — Business details</h2>
            <label className="text-sm font-semibold">Legal business name<input required minLength={4} maxLength={200} value={legalBusinessName} onChange={(event) => setLegalBusinessName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Customer-facing business name<input maxLength={255} value={customerFacingBusinessName} onChange={(event) => setCustomerFacingBusinessName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Business email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Phone<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Contact name<input required minLength={4} value={contactName} onChange={(event) => setContactName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Business type<select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] bg-white px-4 py-3 font-normal">{BUSINESS_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Business category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] bg-white px-4 py-3 font-normal">{BUSINESS_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Registered address<input required value={street1} onChange={(event) => setStreet1(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Address line 2 <span className="font-normal text-[#66716B]">(optional)</span><input value={street2} onChange={(event) => setStreet2(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">City<input required value={city} onChange={(event) => setCity(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">State<select value={state} onChange={(event) => setState(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] bg-white px-4 py-3 font-normal">{INDIAN_STATES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-semibold">PIN code<input required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <button type="submit" disabled={saving} className="min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Continue"}</button>
          </form>
        )}

        {!loading && step === "stakeholder" && (
          <form onSubmit={(event) => void submitStakeholder(event)} className="mt-8 grid gap-4 rounded-[28px] border border-[#DED6C3] bg-white p-8">
            <h2 className="text-2xl font-semibold">Step 2 — Account holder</h2>
            <p className="text-sm text-[#66716B]">Add the person who represents this business for payment verification.</p>
            <label className="text-sm font-semibold">Name as per PAN<input required minLength={4} value={stakeholderName} onChange={(event) => setStakeholderName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Email<input type="email" required value={stakeholderEmail} onChange={(event) => setStakeholderEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Phone<input required value={stakeholderPhone} onChange={(event) => setStakeholderPhone(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <button type="submit" disabled={saving} className="min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Continue"}</button>
          </form>
        )}

        {!loading && step === "product" && (
          <form onSubmit={(event) => void submitProduct(event)} className="mt-8 grid gap-4 rounded-[28px] border border-[#DED6C3] bg-white p-8">
            <h2 className="text-2xl font-semibold">Step 3 — Enable payments</h2>
            <p className="text-sm text-[#66716B]">Request the payment product for this business. No customer charge is created here.</p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={tncAccepted} onChange={(event) => setTncAccepted(event.target.checked)} className="mt-1" />
              <span>I accept the payment terms required to enable settlements for this business.</span>
            </label>
            <button type="submit" disabled={saving || !tncAccepted} className="min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Request payment setup"}</button>
          </form>
        )}

        {!loading && step === "settlements" && (
          <form onSubmit={(event) => void submitSettlements(event)} className="mt-8 grid gap-4 rounded-[28px] border border-[#DED6C3] bg-white p-8">
            <h2 className="text-2xl font-semibold">Step 4 — Settlement bank</h2>
            <p className="text-sm text-[#66716B]">Bank details are sent securely to the payment provider and are not stored in Buzypeezy.</p>
            <label className="text-sm font-semibold">Account number<input required value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">IFSC<input required value={ifscCode} onChange={(event) => setIfscCode(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Beneficiary name<input required minLength={4} value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal" /></label>
            <button type="submit" disabled={saving} className="min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save bank details"}</button>
          </form>
        )}

        {!loading && (step === "verification" || step === "done") && payment?.uiState !== "unavailable" && (
          <div className="mt-8 rounded-[28px] border border-[#DED6C3] bg-white p-8">
            <h2 className="text-2xl font-semibold">{payment?.uiState === "active" ? "Payments Active" : "Verification"}</h2>
            <p className="mt-3 text-sm leading-6 text-[#66716B]">
              {payment?.uiState === "active"
                ? "This business can receive payments once customer checkout is enabled later."
                : "Razorpay verification in progress. Identity and KYC checks may continue on Razorpay."}
            </p>
            {payment?.uiState !== "active" && (
              <button type="button" disabled={saving} onClick={() => void continueVerification()} className="mt-6 min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Checking…" : "Continue Verification"}
              </button>
            )}
            {payment?.verificationUrl && (
              <a href={payment.verificationUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-12 items-center rounded-full border border-[#D8D1BE] px-6 text-sm font-semibold">
                Continue on Razorpay
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function StorePaymentsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F7F3E9] px-6 py-10 text-[#103C32]">Loading payment setup…</main>}>
      <PaymentsContent />
    </Suspense>
  );
}
