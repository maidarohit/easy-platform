import {
  calculateStoreCheckoutAmount,
  isStorePaymentCapturedEvent,
  isStoreRazorpayCheckoutEnabled,
  merchantAccountCanAcceptCheckout,
  parseStoreCheckoutRequest,
  storeCaptureMatchesPayment,
  storeRouteTransferIsValid,
  buildStorePaymentOrderRequest,
  verifyStoreCheckoutSignature,
  type StoreCheckoutProvider,
} from "@/app/lib/store-checkout-core";

export type StoreCheckoutPublication = Readonly<{ id: string; projectId: string }>;
export type StoreCheckoutProduct = Readonly<{
  id: string;
  projectId: string;
  name: string;
  pricePaise: number;
  currency: string;
  isActive: boolean;
}>;
export type StoreCheckoutMerchant = Readonly<{
  id: string;
  projectId: string;
  provider: string;
  providerAccountId: string | null;
  status: string;
}>;
export type StoreCheckoutPaymentRecord = Readonly<{
  id: string;
  orderId: string;
  projectId: string;
  merchantAccountId: string;
  providerAccountId: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  currency: string;
  paymentStatus: string;
}>;

export type StoreCheckoutPersistence = {
  getActivePublication(slug: string): Promise<StoreCheckoutPublication | null>;
  getProduct(productId: string): Promise<StoreCheckoutProduct | null>;
  getMerchantAccount(projectId: string): Promise<StoreCheckoutMerchant | null>;
  createUnpaidCheckout(input: {
    publicationId: string;
    projectId: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    address: string | null;
    note: string | null;
    productId: string;
    productName: string;
    unitPricePaise: number;
    quantity: number;
    totalPaise: number;
    merchantAccountId: string;
    providerAccountId: string;
  }): Promise<{ orderId: string }>;
  attachProviderOrder(orderId: string, providerOrderId: string): Promise<boolean>;
  getPaymentByProviderOrderId(providerOrderId: string): Promise<StoreCheckoutPaymentRecord | null>;
  attachVerifiedProviderPaymentId(input: {
    orderId: string;
    providerOrderId: string;
    providerPaymentId: string;
  }): Promise<"attached" | "already_attached" | "conflict" | "mismatch">;
  applyPaidPayment(input: {
    orderId: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountPaise: number;
    currency: "INR";
  }): Promise<"paid" | "already_paid" | "conflict" | "mismatch">;
  claimPaymentEvent(input: {
    providerEventId: string;
    eventType: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    orderId: string | null;
  }): Promise<"inserted" | "retry" | "already_processed">;
  completePaymentEvent(
    providerEventId: string,
    outcome: "processed" | "ignored_duplicate" | "ignored_unsupported" | "failed",
    orderId?: string | null,
  ): Promise<void>;
};

export async function runStoreCheckout(
  body: unknown,
  deps: {
    env?: NodeJS.Dict<string | undefined>;
    provider: StoreCheckoutProvider;
    store: StoreCheckoutPersistence;
    publicKey: string | null;
  },
) {
  if (!isStoreRazorpayCheckoutEnabled(deps.env)) {
    return { ok: false as const, status: 403, error: "Store checkout is not available." };
  }
  const parsed = parseStoreCheckoutRequest(body);
  if (!parsed.valid) return { ok: false as const, status: 400, error: parsed.error };

  const publication = await deps.store.getActivePublication(parsed.slug);
  if (!publication) return { ok: false as const, status: 404, error: "Business page not found." };

  const product = await deps.store.getProduct(parsed.order.productId);
  if (!product || product.projectId !== publication.projectId || !product.isActive) {
    return { ok: false as const, status: 404, error: "That item is not available." };
  }
  if (product.currency !== "INR") return { ok: false as const, status: 404, error: "That item is not available." };

  const amountPaise = calculateStoreCheckoutAmount(product.pricePaise, parsed.order.quantity);
  if (!amountPaise) return { ok: false as const, status: 400, error: "Please choose an item and provide your name." };

  const merchant = await deps.store.getMerchantAccount(publication.projectId);
  if (!merchant) return { ok: false as const, status: 409, error: "Payments are not available for this business." };
  if (!merchantAccountCanAcceptCheckout({ ...merchant, expectedProjectId: publication.projectId })) {
    return { ok: false as const, status: 409, error: "Payments are not available for this business." };
  }

  const created = await deps.store.createUnpaidCheckout({
    publicationId: publication.id,
    projectId: publication.projectId,
    customerName: parsed.order.name,
    customerEmail: parsed.order.email,
    customerPhone: parsed.order.phone,
    address: parsed.order.address,
    note: parsed.order.note,
    productId: product.id,
    productName: product.name,
    unitPricePaise: product.pricePaise,
    quantity: parsed.order.quantity,
    totalPaise: amountPaise,
    merchantAccountId: merchant.id,
    providerAccountId: merchant.providerAccountId!,
  });

  let providerOrder;
  try {
    const routeOrder = buildStorePaymentOrderRequest({
      amountPaise,
      currency: "INR",
      receipt: created.orderId,
      linkedAccountId: merchant.providerAccountId!,
    });
    if (!storeRouteTransferIsValid(routeOrder)) {
      return { ok: false as const, status: 503, error: "Unable to start payment.", orderId: created.orderId };
    }
    providerOrder = await deps.provider.createStorePaymentOrder({
      amountPaise,
      currency: "INR",
      receipt: created.orderId,
      linkedAccountId: merchant.providerAccountId!,
    });
  } catch {
    return { ok: false as const, status: 503, error: "Unable to start payment.", orderId: created.orderId };
  }

  if (providerOrder.amountPaise !== amountPaise || providerOrder.currency !== "INR") {
    return { ok: false as const, status: 503, error: "Unable to start payment.", orderId: created.orderId };
  }

  const attached = await deps.store.attachProviderOrder(created.orderId, providerOrder.providerOrderId);
  if (!attached) return { ok: false as const, status: 503, error: "Unable to start payment.", orderId: created.orderId };

  return {
    ok: true as const,
    status: 201,
    checkout: {
      orderId: created.orderId,
      providerOrderId: providerOrder.providerOrderId,
      amountPaise,
      currency: "INR" as const,
      keyId: deps.publicKey,
      prefill: {
        name: parsed.order.name,
        email: parsed.order.email,
        contact: parsed.order.phone,
      },
    },
  };
}

export async function runStorePaymentVerification(
  body: unknown,
  deps: { env?: NodeJS.Dict<string | undefined>; store: StoreCheckoutPersistence; secret: string },
) {
  if (!isStoreRazorpayCheckoutEnabled(deps.env)) {
    return { ok: false as const, status: 403, error: "Store checkout is not available." };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const, status: 400, error: "Please check your request." };
  }
  const record = body as Record<string, unknown>;
  const providerOrderId = typeof record.razorpay_order_id === "string" ? record.razorpay_order_id.trim() : "";
  const providerPaymentId = typeof record.razorpay_payment_id === "string" ? record.razorpay_payment_id.trim() : "";
  const signature = typeof record.razorpay_signature === "string" ? record.razorpay_signature.trim() : null;
  if (!providerOrderId.startsWith("order_") || !providerPaymentId.startsWith("pay_")) {
    return { ok: false as const, status: 400, error: "Please check your request." };
  }
  const payment = await deps.store.getPaymentByProviderOrderId(providerOrderId);
  if (!payment || payment.providerOrderId !== providerOrderId) {
    return { ok: false as const, status: 404, error: "Payment was not found." };
  }
  if (!verifyStoreCheckoutSignature(providerOrderId, providerPaymentId, signature, deps.secret)) {
    return { ok: false as const, status: 400, error: "Payment could not be verified." };
  }
  const result = await deps.store.attachVerifiedProviderPaymentId({
    orderId: payment.orderId,
    providerOrderId,
    providerPaymentId,
  });
  if (result === "mismatch") return { ok: false as const, status: 409, error: "Payment could not be verified." };
  if (result === "conflict") return { ok: false as const, status: 409, error: "Payment could not be verified." };
  const paymentStatus = payment.paymentStatus === "paid" ? "paid" as const : "pending" as const;
  return { ok: true as const, status: 200, orderId: payment.orderId, paymentStatus };
}

export async function runStorePaymentWebhook(
  input: {
    rawBody: string;
    signature: string | null;
    eventId: string | null;
    verified: boolean;
  },
  deps: { env?: NodeJS.Dict<string | undefined>; store: StoreCheckoutPersistence },
) {
  if (!isStoreRazorpayCheckoutEnabled(deps.env)) {
    return { ok: false as const, status: 403, error: "Store checkout is not available." };
  }
  if (!input.verified) return { ok: false as const, status: 400, error: "Invalid signature." };
  if (!input.eventId || input.eventId.length > 200) return { ok: false as const, status: 400, error: "Invalid event." };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false as const, status: 400, error: "Invalid event." };
  }
  const eventType = typeof parsed.event === "string" ? parsed.event : "";
  const payload = parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
    ? parsed.payload as Record<string, unknown>
    : {};
  const paymentEntity = nestedEntity(payload.payment);
  const orderEntity = nestedEntity(payload.order);
  const providerPaymentId = stringId(paymentEntity?.id, "pay_");
  const providerOrderId = stringId(paymentEntity?.order_id, "order_") || stringId(orderEntity?.id, "order_");
  const payloadAmount = typeof paymentEntity?.amount === "number" ? paymentEntity.amount
    : typeof orderEntity?.amount === "number" ? orderEntity.amount
      : null;
  const payloadCurrency = typeof paymentEntity?.currency === "string" ? paymentEntity.currency
    : typeof orderEntity?.currency === "string" ? orderEntity.currency
      : null;
  const paymentStatusHint = typeof paymentEntity?.status === "string" ? paymentEntity.status : null;
  const orderStatusHint = typeof orderEntity?.status === "string" ? orderEntity.status : null;

  const claimed = await deps.store.claimPaymentEvent({
    providerEventId: input.eventId,
    eventType: eventType || "unknown",
    providerOrderId,
    providerPaymentId,
    orderId: null,
  });
  if (claimed === "already_processed") {
    return { ok: true as const, status: 200, outcome: "ignored_duplicate" as const };
  }

  if (!isStorePaymentCapturedEvent(eventType) || !providerOrderId) {
    await deps.store.completePaymentEvent(input.eventId, "ignored_unsupported");
    return { ok: true as const, status: 200, outcome: "ignored_unsupported" as const };
  }
  if (eventType === "payment.captured" && paymentStatusHint && paymentStatusHint !== "captured") {
    await deps.store.completePaymentEvent(input.eventId, "failed");
    return { ok: true as const, status: 200, outcome: "failed" as const };
  }
  if (eventType === "order.paid" && orderStatusHint && orderStatusHint !== "paid") {
    await deps.store.completePaymentEvent(input.eventId, "failed");
    return { ok: true as const, status: 200, outcome: "failed" as const };
  }

  const payment = await deps.store.getPaymentByProviderOrderId(providerOrderId);
  if (!payment) {
    await deps.store.completePaymentEvent(input.eventId, "ignored_unsupported");
    return { ok: true as const, status: 200, outcome: "ignored_unsupported" as const };
  }

  const resolvedPaymentId = providerPaymentId ?? payment.providerPaymentId;
  if (!storeCaptureMatchesPayment({
    storedProviderOrderId: payment.providerOrderId,
    storedProviderPaymentId: payment.providerPaymentId,
    storedAmountPaise: payment.amountPaise,
    storedCurrency: payment.currency,
    payloadProviderOrderId: providerOrderId,
    payloadProviderPaymentId: providerPaymentId,
    payloadAmount,
    payloadCurrency,
  }) || !resolvedPaymentId) {
    await deps.store.completePaymentEvent(input.eventId, "failed", payment.orderId);
    return { ok: true as const, status: 200, outcome: "failed" as const };
  }

  const result = await deps.store.applyPaidPayment({
    orderId: payment.orderId,
    providerOrderId,
    providerPaymentId: resolvedPaymentId,
    amountPaise: payment.amountPaise,
    currency: "INR",
  });
  if (result === "conflict" || result === "mismatch") {
    await deps.store.completePaymentEvent(input.eventId, "failed", payment.orderId);
    return { ok: true as const, status: 200, outcome: "failed" as const };
  }
  await deps.store.completePaymentEvent(input.eventId, "processed", payment.orderId);
  return { ok: true as const, status: 200, outcome: "processed" as const, orderId: payment.orderId };
}

function nestedEntity(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entity = (value as { entity?: unknown }).entity;
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) return null;
  return entity as Record<string, unknown>;
}

function stringId(value: unknown, prefix: string): string | null {
  return typeof value === "string" && value.startsWith(prefix) ? value : null;
}
