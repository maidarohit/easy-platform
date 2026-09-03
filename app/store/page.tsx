"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

type ProductKind = "product" | "service";
type StoreProduct = Readonly<{
  id: string;
  name: string;
  kind: ProductKind;
  category: string | null;
  description: string | null;
  pricePaise: number;
  currency: string;
}>;
type PaymentSummary = Readonly<{
  uiState: "not_connected" | "setup_in_progress" | "under_review" | "active" | "needs_action" | "unavailable";
  onboardingStatus: string;
  customerMessage: string | null;
}>;
type StoreOrder = Readonly<{
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryAddress: { text?: string } | null;
  currency: string;
  subtotalPaise: number;
  totalPaise: number;
  status: "pending" | "confirmed" | "fulfilled" | "cancelled";
  paymentStatus: "unpaid" | "pending" | "paid" | "refunded";
  createdAt: string;
  updatedAt: string;
  customerNote: string | null;
  items: readonly Readonly<{
    productName: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>[];
}>;

function formatPrice(pricePaise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(pricePaise / 100);
}

function StorePageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  const projectLink = (path: string) =>
    projectId ? `${path}?projectId=${encodeURIComponent(projectId)}` : path;

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [ordersNotice, setOrdersNotice] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [kind, setKind] = useState<ProductKind>("product");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    let active = true;
    if (!projectId) {
      queueMicrotask(() => {
        if (!active) return;
        setError("Open this page from a business to manage its products and services.");
        setProducts([]);
        setLoading(false);
        setOrders([]);
        setOrdersLoading(false);
        setPayment(null);
        setPaymentLoading(false);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setOrdersLoading(true);
      setError("");
      setOrdersError("");
      setOrdersNotice("");
      setPaymentLoading(true);
      setPaymentError("");
    });
    void authenticatedFetch(
      `/api/store/products?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    ).then(async (response) => {
      const data = await response.json() as { products?: StoreProduct[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load your catalogue.");
      if (active) setProducts(Array.isArray(data.products) ? data.products : []);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Unable to load your catalogue.");
      setProducts([]);
    }).finally(() => { if (active) setLoading(false); });
    void authenticatedFetch(
      `/api/store/orders?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    ).then(async (response) => {
      const data = await response.json() as { orders?: StoreOrder[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load customer orders.");
      if (active) setOrders(Array.isArray(data.orders) ? data.orders : []);
    }).catch((reason) => {
      if (!active) return;
      setOrdersError(reason instanceof Error ? reason.message : "Unable to load customer orders.");
      setOrders([]);
    }).finally(() => { if (active) setOrdersLoading(false); });
    void authenticatedFetch(
      `/api/store/payments/status?projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    ).then(async (response) => {
      const data = await response.json() as { payment?: PaymentSummary; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load payment setup.");
      if (active) setPayment(data.payment ?? null);
    }).catch((reason) => {
      if (!active) return;
      setPaymentError(reason instanceof Error ? reason.message : "Unable to load payment setup.");
      setPayment(null);
    }).finally(() => { if (active) setPaymentLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !projectId) return;
    setSaving(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/store/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name,
          description,
          category,
          kind,
          price,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save this item.");
      setName("");
      setDescription("");
      setCategory("");
      setPrice("");
      setKind("product");
      const refresh = await authenticatedFetch(
        `/api/store/products?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      const refreshed = await refresh.json() as { products?: StoreProduct[]; error?: string };
      if (!refresh.ok) throw new Error(refreshed.error || "Unable to save this item.");
      setProducts(Array.isArray(refreshed.products) ? refreshed.products : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this item.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: StoreOrder["status"]) {
    if (!projectId || updatingOrderId) return;
    setUpdatingOrderId(orderId);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const response = await authenticatedFetch("/api/store/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, orderId, status }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to update this order.");
      const refresh = await authenticatedFetch(
        `/api/store/orders?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      const refreshed = await refresh.json() as { orders?: StoreOrder[]; error?: string };
      if (!refresh.ok) throw new Error(refreshed.error || "Unable to update this order.");
      setOrders(Array.isArray(refreshed.orders) ? refreshed.orders : []);
      setOrdersNotice(
        status === "confirmed" ? "Order confirmed."
          : status === "fulfilled" ? "Order marked fulfilled."
            : status === "cancelled" ? "Order cancelled."
              : "Order updated.",
      );
    } catch (reason) {
      setOrdersError(reason instanceof Error ? reason.message : "Unable to update this order.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F3E9] px-6 py-10 text-[#103C32]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A67C32]">
              Commerce
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              Store & Products
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66716B]">
              Add products or services, manage pricing, receive customer orders,
              and show your catalogue on your business website.
            </p>
          </div>
          <Link
            href={projectLink("/master-workspace")}
            className="rounded-full border border-[#D8D1BE] bg-white px-5 py-3 text-sm font-semibold"
          >
            ← Business Workspace
          </Link>
        </div>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[28px] border border-[#DED6C3] bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A67C32]">
              Catalogue
            </p>
            <h2 className="mt-3 text-xl font-semibold">Products & Services</h2>
            <p className="mt-3 text-sm leading-6 text-[#66716B]">
              Create products or services with names, descriptions, categories,
              and prices.
            </p>
          </div>
          <div className="rounded-[28px] border border-[#DED6C3] bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A67C32]">
              Checkout
            </p>
            <h2 className="mt-3 text-xl font-semibold">Customer Orders</h2>
            <p className="mt-3 text-sm leading-6 text-[#66716B]">
              Customer requests from your published website appear below. Payment is not taken yet.
            </p>
          </div>
          <div className="rounded-[28px] border border-[#DED6C3] bg-[#103C32] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DDBB73]">
              Accept Payments
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              {payment?.uiState === "active" ? "Payments Active"
                : payment?.uiState === "under_review" ? "Razorpay verification in progress"
                  : payment?.uiState === "unavailable" ? "Not available yet"
                    : payment?.uiState === "needs_action" ? "Action needed"
                      : payment?.uiState === "setup_in_progress" ? "Setup in progress"
                        : "Set up payments for this business"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Connect a payment account for this business, separate from your Buzypeezy subscription.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-[30px] border border-[#DED6C3] bg-white p-8">
          <h2 className="text-2xl font-semibold">Accept Payments</h2>
          {paymentLoading && <p className="mt-4 text-sm text-[#66716B]">Checking payment setup…</p>}
          {paymentError && <p role="status" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{paymentError}</p>}
          {!paymentLoading && !projectId && (
            <p className="mt-4 text-sm text-[#66716B]">Open this page from a business to set up payments.</p>
          )}
          {!paymentLoading && projectId && payment?.uiState === "not_connected" && (
            <div className="mt-4">
              <p className="text-sm leading-6 text-[#66716B]">Set up payments for this business</p>
              <Link href={projectLink("/store/payments")} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white">Set Up Payments</Link>
            </div>
          )}
          {!paymentLoading && payment?.uiState === "setup_in_progress" && (
            <div className="mt-4">
              <p className="text-sm text-[#66716B]">Onboarding status: {payment.onboardingStatus.replace(/_/g, " ")}</p>
              <Link href={projectLink("/store/payments")} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white">Continue Setup</Link>
            </div>
          )}
          {!paymentLoading && payment?.uiState === "under_review" && (
            <div className="mt-4">
              <p className="font-semibold">Razorpay verification in progress</p>
              <Link href={projectLink("/store/payments")} className="mt-4 inline-flex min-h-12 items-center rounded-full border border-[#D8D1BE] px-6 text-sm font-semibold">Continue Setup</Link>
            </div>
          )}
          {!paymentLoading && payment?.uiState === "active" && (
            <p className="mt-4 font-semibold">Payments Active</p>
          )}
          {!paymentLoading && payment?.uiState === "needs_action" && (
            <div className="mt-4">
              <p className="text-sm leading-6 text-[#66716B]">{payment.customerMessage || "Please complete the remaining payment details."}</p>
              <Link href={projectLink("/store/payments")} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white">Continue Setup</Link>
            </div>
          )}
          {!paymentLoading && payment?.uiState === "unavailable" && (
            <p className="mt-4 text-sm leading-6 text-[#66716B]">Payment onboarding is not available yet. Please contact Buzypeezy support.</p>
          )}
        </section>

        <section className="mt-8 rounded-[30px] border border-[#DED6C3] bg-white p-8">
          <h2 className="text-2xl font-semibold">Add Product or Service</h2>
          <p className="mt-2 text-sm text-[#66716B]">
            Save items to this business catalogue. Requests from your live website appear in Customer Orders.
          </p>
          <form onSubmit={(event) => void addProduct(event)} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold">
              Type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value === "service" ? "service" : "product")}
                className="mt-2 w-full rounded-xl border border-[#D8D1BE] bg-white px-4 py-3 font-normal"
              >
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={160}
                className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Category <span className="font-normal text-[#66716B]">(optional)</span>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                maxLength={120}
                className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Price (INR)
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                required
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold md:col-span-2">
              Description <span className="font-normal text-[#66716B]">(optional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="mt-2 w-full resize-y rounded-xl border border-[#D8D1BE] px-4 py-3 font-normal"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || loading || !projectId}
                className="min-h-12 rounded-full bg-[#103C32] px-6 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "+ Add Product or Service"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 rounded-[30px] border border-[#DED6C3] bg-white p-8">
          <h2 className="text-2xl font-semibold">Your catalogue</h2>
          {loading && <p className="mt-4 text-sm text-[#66716B]">Loading your products and services…</p>}
          {error && <p role="status" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {!loading && !error && products.length === 0 && (
            <p className="mt-4 text-sm text-[#66716B]">No products or services added yet.</p>
          )}
          {!loading && products.length > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {products.map((product) => (
                <article key={product.id} className="rounded-[24px] border border-[#DED6C3] bg-[#FCFBF7] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A67C32]">
                    {product.kind === "service" ? "Service" : "Product"}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{product.name}</h3>
                  {product.category && <p className="mt-2 text-sm text-[#66716B]">{product.category}</p>}
                  {product.description && <p className="mt-3 text-sm leading-6 text-[#66716B]">{product.description}</p>}
                  <p className="mt-4 text-lg font-semibold">{formatPrice(product.pricePaise, product.currency || "INR")}</p>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="mt-8 rounded-[30px] border border-[#DED6C3] bg-white p-8">
          <h2 className="text-2xl font-semibold">Customer Orders</h2>
          <p className="mt-2 text-sm text-[#66716B]">Requests sent from your published website. No payment is collected here.</p>
          {ordersLoading && <p className="mt-4 text-sm text-[#66716B]">Loading customer orders…</p>}
          {ordersNotice && <p role="status" className="mt-4 rounded-xl border border-[#C9D9C6] bg-[#F3F7F1] p-4 text-sm">{ordersNotice}</p>}
          {ordersError && <p role="status" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ordersError}</p>}
          {!ordersLoading && !ordersError && orders.length === 0 && (
            <p className="mt-4 text-sm text-[#66716B]">No customer requests yet.</p>
          )}
          {!ordersLoading && orders.length > 0 && (
            <div className="mt-6 grid gap-4">
              {orders.map((order) => (
                <article key={order.id} className="rounded-[24px] border border-[#DED6C3] bg-[#FCFBF7] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A67C32]">{order.status}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#66716B]">Payment: {order.paymentStatus}</p>
                      <h3 className="mt-2 text-xl font-semibold">{order.customerName}</h3>
                      <p className="mt-2 text-sm text-[#66716B]">
                        {[order.customerEmail, order.customerPhone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">{formatPrice(order.totalPaise, order.currency || "INR")}</p>
                  </div>
                  <p className="mt-2 text-sm text-[#66716B]">
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>{item.quantity} × {item.productName} — {formatPrice(item.lineTotalPaise, order.currency || "INR")}</li>
                    ))}
                  </ul>
                  {order.deliveryAddress?.text && <p className="mt-3 text-sm text-[#66716B]">Address: {order.deliveryAddress.text}</p>}
                  {order.customerNote && <p className="mt-3 text-sm text-[#66716B]">Note: {order.customerNote}</p>}
                  {order.status === "pending" && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" disabled={Boolean(updatingOrderId)} onClick={() => void updateOrderStatus(order.id, "confirmed")} className="min-h-11 rounded-full bg-[#103C32] px-5 text-sm font-semibold text-white disabled:opacity-50">{updatingOrderId === order.id ? "Updating…" : "Confirm"}</button>
                      <button type="button" disabled={Boolean(updatingOrderId)} onClick={() => void updateOrderStatus(order.id, "cancelled")} className="min-h-11 rounded-full border border-[#D8D1BE] px-5 text-sm font-semibold disabled:opacity-50">Cancel</button>
                    </div>
                  )}
                  {order.status === "confirmed" && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" disabled={Boolean(updatingOrderId)} onClick={() => void updateOrderStatus(order.id, "fulfilled")} className="min-h-11 rounded-full bg-[#103C32] px-5 text-sm font-semibold text-white disabled:opacity-50">{updatingOrderId === order.id ? "Updating…" : "Mark Fulfilled"}</button>
                      <button type="button" disabled={Boolean(updatingOrderId)} onClick={() => void updateOrderStatus(order.id, "cancelled")} className="min-h-11 rounded-full border border-[#D8D1BE] px-5 text-sm font-semibold disabled:opacity-50">Cancel</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F7F3E9] px-6 py-10 text-[#103C32]">Loading store…</main>}>
      <StorePageContent />
    </Suspense>
  );
}
