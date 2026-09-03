"use client";

import { useEffect, useState, type FormEvent } from "react";

type CatalogueItem = Readonly<{ id: string; name: string; kind: "product" | "service" }>;

type RazorpayResult = Readonly<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}>;

type RazorpayCheckout = new (options: Record<string, unknown>) => { open(): void };

function loadRazorpayCheckout(): Promise<boolean> {
  if ((window as typeof window & { Razorpay?: RazorpayCheckout }).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function OrderForm({
  slug,
  products,
  selectedProductId,
  primary,
  checkoutReady,
}: {
  slug: string;
  products: readonly CatalogueItem[];
  selectedProductId: string;
  primary: string;
  checkoutReady: boolean;
}) {
  const [productId, setProductId] = useState(selectedProductId || products[0]?.id || "");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);

  useEffect(() => {
    if (!checkoutReady) return;
    let active = true;
    void loadRazorpayCheckout().then((loaded) => { if (active) setCheckoutAvailable(loaded); });
    return () => { active = false; };
  }, [checkoutReady]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      slug,
      productId: form.get("productId"),
      quantity: form.get("quantity"),
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      address: form.get("address"),
      note: form.get("note"),
      company: form.get("company"),
    };
    try {
      const response = await fetch(checkoutAvailable ? "/api/public-business-orders/checkout" : "/api/public-business-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as {
        error?: string;
        message?: string;
        checkout?: Readonly<{
          providerOrderId: string;
          amountPaise: number;
          currency: "INR";
          keyId: string;
          prefill: Readonly<{ name: string; email: string; contact: string }>;
        }>;
      };
      if (!response.ok) throw new Error(data.error || "Unable to send your request.");
      if (checkoutAvailable && data.checkout) {
        const Razorpay = (window as typeof window & { Razorpay?: RazorpayCheckout }).Razorpay;
        if (!Razorpay) throw new Error("Payment is unavailable right now. Please send a request instead.");
        const checkout = data.checkout;
        new Razorpay({
          key: checkout.keyId,
          order_id: checkout.providerOrderId,
          amount: checkout.amountPaise,
          currency: checkout.currency,
          name: "Secure checkout",
          prefill: checkout.prefill,
          handler: async (result: RazorpayResult) => {
            const verification = await fetch("/api/public-business-orders/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const verified = await verification.json() as { error?: string; paymentStatus?: string };
            setStatus(verification.ok
              ? verified.paymentStatus === "paid" ? "Payment received. Your order has been placed." : "Payment received and is being confirmed."
              : verified.error || "Payment could not be verified.");
          },
          modal: { ondismiss: () => setStatus("Payment was not completed. You can try again.") },
        }).open();
        return;
      }
      setStatus(data.message || "Your request has been sent to the business.");
      formElement.reset();
      setProductId(products[0]?.id || "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send your request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form id="order" onSubmit={(event) => void submit(event)} className="scroll-mt-28 rounded-[2rem] bg-white p-6 text-left text-[#1B211E] sm:p-8">
      <h3 className="text-2xl font-semibold">{checkoutAvailable ? "Buy an item" : "Request an item"}</h3>
      <p className="mt-2 text-sm leading-6 opacity-65">{checkoutAvailable ? "Complete your purchase using secure checkout." : "No payment is taken here. The business will receive your request and follow up."}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">
          Product or service
          <select name="productId" required value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 font-normal">
            {products.map((item) => (
              <option key={item.id} value={item.id}>{item.name} ({item.kind === "service" ? "Service" : "Product"})</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Quantity
          <input name="quantity" type="number" min={1} max={20} defaultValue={1} required className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Name
          <input name="name" required minLength={2} maxLength={160} autoComplete="name" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Email
          <input name="email" type="email" maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input name="phone" type="tel" maxLength={32} autoComplete="tel" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Delivery / address <span className="font-normal opacity-55">(optional)</span>
          <textarea name="address" maxLength={500} rows={3} className="mt-2 w-full resize-y rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Note <span className="font-normal opacity-55">(optional)</span>
          <textarea name="note" maxLength={2000} rows={3} className="mt-2 w-full resize-y rounded-xl border border-black/15 px-4 py-3 font-normal" />
        </label>
      </div>
      <p className="mt-3 text-xs opacity-55">Provide at least an email or phone number.</p>
      <label className="hidden" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
      <button type="submit" disabled={sending} className="mt-5 min-h-12 rounded-full px-7 font-semibold text-white disabled:opacity-60" style={{ backgroundColor: primary }}>
        {sending ? "Please wait…" : checkoutAvailable ? "Proceed to checkout" : "Send request"}
      </button>
      {status && <p role="status" className="mt-4 text-sm font-semibold">{status}</p>}
    </form>
  );
}
