import "server-only";

import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/app/db";
import {
  businessPublications,
  projectMerchantPaymentAccounts,
  projectProducts,
  publicBusinessOrderItems,
  publicBusinessOrderPayments,
  publicBusinessOrders,
  publicBusinessPaymentEvents,
} from "@/app/db/schema";
import { canMarkStoreOrderPaid, isRetryableStorePaymentEvent } from "@/app/lib/store-checkout-core";
import type { StoreCheckoutPersistence } from "@/app/lib/store-checkout-service";

export const drizzleStoreCheckoutPersistence: StoreCheckoutPersistence = {
  async getActivePublication(slug) {
    const [publication] = await db.select({
      id: businessPublications.id,
      projectId: businessPublications.projectId,
    }).from(businessPublications).where(and(
      eq(businessPublications.publicSlug, slug),
      eq(businessPublications.status, "active"),
    )).limit(1);
    return publication ?? null;
  },

  async getProduct(productId) {
    const [product] = await db.select({
      id: projectProducts.id,
      projectId: projectProducts.projectId,
      name: projectProducts.name,
      pricePaise: projectProducts.pricePaise,
      currency: projectProducts.currency,
      isActive: projectProducts.isActive,
    }).from(projectProducts).where(eq(projectProducts.id, productId)).limit(1);
    return product ?? null;
  },

  async getMerchantAccount(projectId) {
    const [account] = await db.select({
      id: projectMerchantPaymentAccounts.id,
      projectId: projectMerchantPaymentAccounts.projectId,
      provider: projectMerchantPaymentAccounts.provider,
      providerAccountId: projectMerchantPaymentAccounts.providerAccountId,
      status: projectMerchantPaymentAccounts.status,
    }).from(projectMerchantPaymentAccounts).where(and(
      eq(projectMerchantPaymentAccounts.projectId, projectId),
      eq(projectMerchantPaymentAccounts.provider, "razorpay"),
    )).limit(1);
    return account ?? null;
  },

  async createUnpaidCheckout(input) {
    return db.transaction(async (transaction) => {
      const [order] = await transaction.insert(publicBusinessOrders).values({
        projectId: input.projectId,
        publicationId: input.publicationId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deliveryAddress: input.address ? { text: input.address } : null,
        currency: "INR",
        subtotalPaise: input.totalPaise,
        totalPaise: input.totalPaise,
        status: "pending",
        paymentStatus: "unpaid",
        customerNote: input.note,
      }).returning({ id: publicBusinessOrders.id });
      if (!order) throw new Error("Unable to create store order.");
      await transaction.insert(publicBusinessOrderItems).values({
        orderId: order.id,
        productId: input.productId,
        productName: input.productName,
        unitPricePaise: input.unitPricePaise,
        quantity: input.quantity,
        lineTotalPaise: input.totalPaise,
      });
      await transaction.insert(publicBusinessOrderPayments).values({
        orderId: order.id,
        projectId: input.projectId,
        merchantAccountId: input.merchantAccountId,
        provider: "razorpay",
        providerAccountId: input.providerAccountId,
        providerReceipt: order.id,
        amountPaise: input.totalPaise,
        currency: "INR",
      });
      return { orderId: order.id };
    });
  },

  async attachProviderOrder(orderId, providerOrderId) {
    try {
      return await db.transaction(async (transaction) => {
        const [payment] = await transaction.update(publicBusinessOrderPayments).set({
          providerOrderId,
          updatedAt: new Date(),
        }).where(and(
          eq(publicBusinessOrderPayments.orderId, orderId),
          isNull(publicBusinessOrderPayments.providerOrderId),
        )).returning({ id: publicBusinessOrderPayments.id });
        if (!payment) return false;
        const [order] = await transaction.update(publicBusinessOrders).set({
          paymentStatus: "pending",
          updatedAt: new Date(),
        }).where(and(
          eq(publicBusinessOrders.id, orderId),
          eq(publicBusinessOrders.paymentStatus, "unpaid"),
        )).returning({ id: publicBusinessOrders.id });
        return Boolean(order);
      });
    } catch {
      return false;
    }
  },

  async getPaymentByProviderOrderId(providerOrderId) {
    const [row] = await db.select({
      id: publicBusinessOrderPayments.id,
      orderId: publicBusinessOrderPayments.orderId,
      projectId: publicBusinessOrderPayments.projectId,
      merchantAccountId: publicBusinessOrderPayments.merchantAccountId,
      providerAccountId: publicBusinessOrderPayments.providerAccountId,
      providerOrderId: publicBusinessOrderPayments.providerOrderId,
      providerPaymentId: publicBusinessOrderPayments.providerPaymentId,
      amountPaise: publicBusinessOrderPayments.amountPaise,
      currency: publicBusinessOrderPayments.currency,
      paymentStatus: publicBusinessOrders.paymentStatus,
    }).from(publicBusinessOrderPayments)
      .innerJoin(publicBusinessOrders, eq(publicBusinessOrders.id, publicBusinessOrderPayments.orderId))
      .where(eq(publicBusinessOrderPayments.providerOrderId, providerOrderId))
      .limit(1);
    return row ?? null;
  },

  async attachVerifiedProviderPaymentId(input) {
    return db.transaction(async (transaction) => {
      const [row] = await transaction.select({
        orderId: publicBusinessOrderPayments.orderId,
        providerOrderId: publicBusinessOrderPayments.providerOrderId,
        providerPaymentId: publicBusinessOrderPayments.providerPaymentId,
      }).from(publicBusinessOrderPayments)
        .where(and(
          eq(publicBusinessOrderPayments.orderId, input.orderId),
          eq(publicBusinessOrderPayments.providerOrderId, input.providerOrderId),
        ))
        .limit(1);
      if (!row || row.providerOrderId !== input.providerOrderId) return "mismatch";

      const [taken] = await transaction.select({
        orderId: publicBusinessOrderPayments.orderId,
      }).from(publicBusinessOrderPayments).where(and(
        eq(publicBusinessOrderPayments.providerPaymentId, input.providerPaymentId),
        ne(publicBusinessOrderPayments.orderId, input.orderId),
      )).limit(1);
      if (taken) return "conflict";
      if (row.providerPaymentId && row.providerPaymentId !== input.providerPaymentId) return "conflict";
      if (row.providerPaymentId === input.providerPaymentId) return "already_attached";

      const [payment] = await transaction.update(publicBusinessOrderPayments).set({
        providerPaymentId: input.providerPaymentId,
        updatedAt: new Date(),
      }).where(and(
        eq(publicBusinessOrderPayments.orderId, input.orderId),
        eq(publicBusinessOrderPayments.providerOrderId, input.providerOrderId),
        isNull(publicBusinessOrderPayments.providerPaymentId),
      )).returning({ id: publicBusinessOrderPayments.id });
      return payment ? "attached" : "conflict";
    });
  },

  async applyPaidPayment(input) {
    return db.transaction(async (transaction) => {
      const [row] = await transaction.select({
        orderId: publicBusinessOrderPayments.orderId,
        providerOrderId: publicBusinessOrderPayments.providerOrderId,
        providerPaymentId: publicBusinessOrderPayments.providerPaymentId,
        amountPaise: publicBusinessOrderPayments.amountPaise,
        currency: publicBusinessOrderPayments.currency,
        paymentStatus: publicBusinessOrders.paymentStatus,
      }).from(publicBusinessOrderPayments)
        .innerJoin(publicBusinessOrders, eq(publicBusinessOrders.id, publicBusinessOrderPayments.orderId))
        .where(and(
          eq(publicBusinessOrderPayments.orderId, input.orderId),
          eq(publicBusinessOrderPayments.providerOrderId, input.providerOrderId),
        ))
        .limit(1);
      if (!row || row.amountPaise !== input.amountPaise || row.currency !== input.currency || row.currency !== "INR" || !canMarkStoreOrderPaid(row.paymentStatus)) {
        return "mismatch";
      }

      const [taken] = await transaction.select({
        orderId: publicBusinessOrderPayments.orderId,
      }).from(publicBusinessOrderPayments).where(and(
        eq(publicBusinessOrderPayments.providerPaymentId, input.providerPaymentId),
        ne(publicBusinessOrderPayments.orderId, input.orderId),
      )).limit(1);
      if (taken) return "conflict";

      if (row.providerPaymentId && row.providerPaymentId !== input.providerPaymentId) return "conflict";
      if (row.providerPaymentId === input.providerPaymentId && row.paymentStatus === "paid") {
        return "already_paid";
      }

      const [payment] = await transaction.update(publicBusinessOrderPayments).set({
        providerPaymentId: input.providerPaymentId,
        updatedAt: new Date(),
      }).where(and(
        eq(publicBusinessOrderPayments.orderId, input.orderId),
        eq(publicBusinessOrderPayments.providerOrderId, input.providerOrderId),
        or(
          isNull(publicBusinessOrderPayments.providerPaymentId),
          eq(publicBusinessOrderPayments.providerPaymentId, input.providerPaymentId),
        ),
      )).returning({ id: publicBusinessOrderPayments.id });
      if (!payment) return "conflict";

      const [order] = await transaction.update(publicBusinessOrders).set({
        paymentStatus: "paid",
        updatedAt: new Date(),
      }).where(and(
        eq(publicBusinessOrders.id, input.orderId),
        sql`${publicBusinessOrders.paymentStatus} in ('unpaid','pending','paid')`,
      )).returning({
        id: publicBusinessOrders.id,
        status: publicBusinessOrders.status,
        paymentStatus: publicBusinessOrders.paymentStatus,
      });
      if (!order) return "mismatch";
      return row.paymentStatus === "paid" ? "already_paid" : "paid";
    });
  },

  async claimPaymentEvent(input) {
    const inserted = await db.insert(publicBusinessPaymentEvents).values({
      providerEventId: input.providerEventId,
      eventType: input.eventType.slice(0, 100),
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      orderId: input.orderId,
    }).onConflictDoNothing().returning({ providerEventId: publicBusinessPaymentEvents.providerEventId });
    if (inserted.length > 0) return "inserted";

    const [existing] = await db.select({
      outcome: publicBusinessPaymentEvents.outcome,
      processedAt: publicBusinessPaymentEvents.processedAt,
    }).from(publicBusinessPaymentEvents)
      .where(eq(publicBusinessPaymentEvents.providerEventId, input.providerEventId))
      .limit(1);
    if (!existing) return "retry";
    return isRetryableStorePaymentEvent(existing.outcome, existing.processedAt) ? "retry" : "already_processed";
  },

  async completePaymentEvent(providerEventId, outcome, orderId) {
    await db.update(publicBusinessPaymentEvents).set({
      outcome,
      processedAt: new Date(),
      ...(orderId ? { orderId } : {}),
    }).where(eq(publicBusinessPaymentEvents.providerEventId, providerEventId));
  },
};
