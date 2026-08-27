import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { requirePaidProductAccess } from "@/app/lib/paid-entitlements";

const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

function safeFilename(value: string | null) {
  const filename = (value ?? "buzypeezy-export").replace(/[^a-zA-Z0-9._ -]/g, "").trim();
  return filename || "buzypeezy-export";
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const paid = await requirePaidProductAccess(userId);
  if (!paid.ok) return paid.response;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_EXPORT_BYTES) return Response.json({ error: "Export is too large." }, { status: 413 });
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return Response.json({ error: "Export is empty." }, { status: 400 });
  if (bytes.byteLength > MAX_EXPORT_BYTES) return Response.json({ error: "Export is too large." }, { status: 413 });

  const filename = safeFilename(request.headers.get("x-export-filename"));
  return new Response(bytes, {
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
