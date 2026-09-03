import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/app/db";
import { publicBusinessOrderItems, publicBusinessOrders } from "@/app/db/schema";
import {
  canTransitionOwnerOrderStatus,
  isOwnerOrderStatus,
  ownerOrderStatusUpdateError,
  type OwnerOrderStatus,
} from "@/app/lib/store-order-status";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";
import { requireOwnedStoreProject } from "@/app/lib/store-project-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serializeOrder<T extends {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryAddress: unknown;
  currency: string;
  subtotalPaise: number;
  totalPaise: number;
  status: string;
  paymentStatus: string;
  customerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}>(order: T, items: readonly {
  productName: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}[]) {
  return {
    id: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    currency: order.currency,
    subtotalPaise: order.subtotalPaise,
    totalPaise: order.totalPaise,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerNote: order.customerNote,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
  };
}

const orderColumns = {
  id: publicBusinessOrders.id,
  customerName: publicBusinessOrders.customerName,
  customerEmail: publicBusinessOrders.customerEmail,
  customerPhone: publicBusinessOrders.customerPhone,
  deliveryAddress: publicBusinessOrders.deliveryAddress,
  currency: publicBusinessOrders.currency,
  subtotalPaise: publicBusinessOrders.subtotalPaise,
  totalPaise: publicBusinessOrders.totalPaise,
  status: publicBusinessOrders.status,
  paymentStatus: publicBusinessOrders.paymentStatus,
  customerNote: publicBusinessOrders.customerNote,
  createdAt: publicBusinessOrders.createdAt,
  updatedAt: publicBusinessOrders.updatedAt,
};

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  const owner = await requireOwnedStoreProject(request, projectId);
  if (owner.error) return Response.json({ error: owner.error }, { status: owner.status });

  const orders = await db.select(orderColumns).from(publicBusinessOrders)
    .where(eq(publicBusinessOrders.projectId, owner.projectId))
    .orderBy(desc(publicBusinessOrders.createdAt));

  const orderIds = orders.map((order) => order.id);
  const items = orderIds.length === 0 ? [] : await db.select({
    orderId: publicBusinessOrderItems.orderId,
    productName: publicBusinessOrderItems.productName,
    quantity: publicBusinessOrderItems.quantity,
    unitPricePaise: publicBusinessOrderItems.unitPricePaise,
    lineTotalPaise: publicBusinessOrderItems.lineTotalPaise,
  }).from(publicBusinessOrderItems).where(inArray(publicBusinessOrderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return Response.json({
    orders: orders.map((order) => serializeOrder(order, (itemsByOrder.get(order.id) ?? []).map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.lineTotalPaise,
    })))),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 2_048);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Invalid request body." }, { status: 400 });
    throw error;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "projectId" && key !== "orderId" && key !== "status")) {
    return Response.json({ error: "Unsupported order field." }, { status: 400 });
  }

  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  const orderId = typeof record.orderId === "string" ? record.orderId.trim().toLowerCase() : "";
  const status = record.status;
  const owner = await requireOwnedStoreProject(request, projectId);
  if (owner.error) return Response.json({ error: owner.error }, { status: owner.status });
  if (!UUID.test(orderId) || !isOwnerOrderStatus(status)) {
    return Response.json({ error: "A valid order and status are required." }, { status: 400 });
  }

  const [existing] = await db.select({
    id: publicBusinessOrders.id,
    status: publicBusinessOrders.status,
  }).from(publicBusinessOrders).where(and(
    eq(publicBusinessOrders.id, orderId),
    eq(publicBusinessOrders.projectId, owner.projectId),
  )).limit(1);

  if (!existing) return Response.json({ error: "Order not found." }, { status: 404 });

  const currentStatus = existing.status as OwnerOrderStatus;
  if (!canTransitionOwnerOrderStatus(currentStatus, status)) {
    return Response.json({ error: ownerOrderStatusUpdateError(currentStatus, status) }, { status: 409 });
  }

  const now = new Date();
  const [updated] = await db.update(publicBusinessOrders).set({
    status,
    updatedAt: now,
  }).where(and(
    eq(publicBusinessOrders.id, orderId),
    eq(publicBusinessOrders.projectId, owner.projectId),
    eq(publicBusinessOrders.status, currentStatus),
  )).returning(orderColumns);

  if (!updated) {
    return Response.json({ error: "This order was already updated. Refresh and try again." }, { status: 409 });
  }

  const items = await db.select({
    productName: publicBusinessOrderItems.productName,
    quantity: publicBusinessOrderItems.quantity,
    unitPricePaise: publicBusinessOrderItems.unitPricePaise,
    lineTotalPaise: publicBusinessOrderItems.lineTotalPaise,
  }).from(publicBusinessOrderItems).where(eq(publicBusinessOrderItems.orderId, updated.id));

  return Response.json({ order: serializeOrder(updated, items) }, { headers: { "Cache-Control": "no-store" } });
}
