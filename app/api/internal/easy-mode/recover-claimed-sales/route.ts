import { executeNextEasyModeTask } from "@/app/lib/easy-mode-executor";
import { RECOVERY_RUN_ID, releaseClaimedSalesForOneRetry, validateCurrentClaimedSales } from "@/app/lib/boss-sales-claimed-recovery";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { readLimitedJson } from "@/app/lib/request-body";

async function identity(request: Request) { try { const uid = (await verifyFirebaseIdToken(request)).uid; return { uid, bossAdmin: isBossAdmin(uid) }; } catch { return null; } }
export async function GET(request: Request) {
  const auth = await identity(request); if (!auth) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const state = await validateCurrentClaimedSales(auth.uid, auth.bossAdmin); return state ? Response.json(state, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Recovery is not available for this account or its preconditions changed." }, { status: 409 });
}
export async function POST(request: Request) {
  const auth = await identity(request); if (!auth) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try { const body = await readLimitedJson(request, 1_024); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) return Response.json({ error: "Invalid request." }, { status: 400 }); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const released = await releaseClaimedSalesForOneRetry(auth.uid, auth.bossAdmin); if (!released) return Response.json({ error: "Recovery is not available for this account or its state changed; no provider call was made." }, { status: 409 });
  const result = await executeNextEasyModeTask({ runId: RECOVERY_RUN_ID, userId: released.runOwnerId });
  return Response.json(result, { status: result.state === "completed" ? 200 : 422, headers: { "Cache-Control": "no-store" } });
}
