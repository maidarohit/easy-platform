import "server-only";
import { createHmac } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { businessPublications, publicBusinessInquiries } from "@/app/db/schema";
import { validateBusinessSlug } from "@/app/lib/business-publication";
import { validatePublicInquiry } from "@/app/lib/public-inquiry";
import { MalformedJsonBodyError, readLimitedJson, RequestBodyTooLargeError } from "@/app/lib/request-body";

function sourceIp(request: Request) { return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
function sourceHash(request: Request) { return createHmac("sha256", process.env.INQUIRY_HASH_SECRET || process.env.DATABASE_URL || "local-inquiry-key").update(sourceIp(request)).digest("hex"); }
export async function POST(request: Request) {
  let body: unknown;
  try { body = await readLimitedJson(request, 8_192); }
  catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Your enquiry is too large." }, { status: 413 });
    if (error instanceof MalformedJsonBodyError) return Response.json({ error: "Please check your enquiry." }, { status: 400 });
    throw error;
  }
  const slug = validateBusinessSlug(body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).slug : null);
  const checked = validatePublicInquiry(body);
  if (!slug || !checked.valid) return Response.json({ error: checked.valid ? "Business page not found." : checked.error }, { status: 400 });
  const ipHash = sourceHash(request); const cutoff = new Date(Date.now() - 60 * 60 * 1_000);
  const outcome = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`inquiry:${slug}:${ipHash}`}))`);
    const [publication] = await transaction.select({ id: businessPublications.id, projectId: businessPublications.projectId }).from(businessPublications).where(and(eq(businessPublications.publicSlug, slug), eq(businessPublications.status, "active"))).limit(1);
    if (!publication) return "missing" as const;
    const [recent] = await transaction.select({ total: count() }).from(publicBusinessInquiries).where(and(eq(publicBusinessInquiries.publicationId, publication.id), eq(publicBusinessInquiries.sourceIpHash, ipHash), gt(publicBusinessInquiries.createdAt, cutoff)));
    if ((recent?.total ?? 0) >= 5) return "limited" as const;
    await transaction.insert(publicBusinessInquiries).values({ publicationId: publication.id, projectId: publication.projectId, ...checked.inquiry, sourceIpHash: ipHash });
    return "saved" as const;
  });
  if (outcome === "missing") return Response.json({ error: "Business page not found." }, { status: 404 });
  if (outcome === "limited") return Response.json({ error: "Too many enquiries. Please try again later." }, { status: 429 });
  return Response.json({ success: true, message: "Thanks — your enquiry has been received." }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
