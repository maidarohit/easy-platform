import "server-only";
import { createHmac } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { businessPublications, projectProducts, publicBusinessOrderItems, publicBusinessOrders } from "@/app/db/schema";
import { validateBusinessSlug } from "@/app/lib/business-publication";
import { validatePublicOrder } from "@/app/lib/public-order";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

function sourceIp(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
function sourceHash(request: Request) {
  return createHmac("sha256", process.env.INQUIRY_HASH_SECRET || process.env.DATABASE_URL || "local-inquiry-key").update(sourceIp(request)).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await readLimitedJson(request, 8_192); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Your request is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Please check your request." }, { status: 400 });
    throw error;
  }
  const slug = validateBusinessSlug(body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).slug : null);
  const checked = validatePublicOrder(body);
  if (!slug || !checked.valid) return Response.json({ error: checked.valid ? "Business page not found." : checked.error }, { status: 400 });
  const ipHash = sourceHash(request);
  const cutoff = new Date(Date.now() - 60 * 60 * 1_000);
  const outcome = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`order:${slug}:${ipHash}`}))`);
    const [publication] = await transaction.select({
      id: businessPublications.id,
      projectId: businessPublications.projectId,
    }).from(businessPublications).where(and(
      eq(businessPublications.publicSlug, slug),
      eq(businessPublications.status, "active"),
    )).limit(1);
    if (!publication) return "missing" as const;
    const [recent] = await transaction.select({ total: count() }).from(publicBusinessOrders).where(and(
      eq(publicBusinessOrders.publicationId, publication.id),
      gt(publicBusinessOrders.createdAt, cutoff),
    ));
    if ((recent?.total ?? 0) >= 20) return "limited" as const;
    const [product] = await transaction.select({
      id: projectProducts.id,
      name: projectProducts.name,
      pricePaise: projectProducts.pricePaise,
      currency: projectProducts.currency,
    }).from(projectProducts).where(and(
      eq(projectProducts.id, checked.order.productId),
      eq(projectProducts.projectId, publication.projectId),
      eq(projectProducts.isActive, true),
    )).limit(1);
    if (!product) return "unavailable" as const;
    const lineTotalPaise = product.pricePaise * checked.order.quantity;
    if (!Number.isSafeInteger(lineTotalPaise) || lineTotalPaise < 0) return "unavailable" as const;
    const [order] = await transaction.insert(publicBusinessOrders).values({
      projectId: publication.projectId,
      publicationId: publication.id,
      customerName: checked.order.name,
      customerEmail: checked.order.email,
      customerPhone: checked.order.phone,
      deliveryAddress: checked.order.address ? { text: checked.order.address } : null,
      currency: product.currency || "INR",
      subtotalPaise: lineTotalPaise,
      totalPaise: lineTotalPaise,
      status: "pending",
      paymentStatus: "unpaid",
      customerNote: checked.order.note,
    }).returning({ id: publicBusinessOrders.id });
    if (!order) return "unavailable" as const;
    await transaction.insert(publicBusinessOrderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      unitPricePaise: product.pricePaise,
      quantity: checked.order.quantity,
      lineTotalPaise,
    });
    return "saved" as const;
  });
  if (outcome === "missing") return Response.json({ error: "Business page not found." }, { status: 404 });
  if (outcome === "unavailable") return Response.json({ error: "That item is not available." }, { status: 404 });
  if (outcome === "limited") return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  return Response.json({ success: true, message: "Your request has been sent to the business." }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
