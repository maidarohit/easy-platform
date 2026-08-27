import { executeNextEasyModeTask } from "@/app/lib/easy-mode-executor";
import { RECOVERY_RUN_ID, releaseClaimedSalesForOneRetry, validateCurrentClaimedSales } from "@/app/lib/boss-sales-claimed-recovery";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";
import { readLimitedJson } from "@/app/lib/request-body";

async function boss(request: Request) { try { const uid = (await verifyFirebaseIdToken(request)).uid; return isBossAdmin(uid) ? uid : null; } catch { return null; } }
export async function GET(request: Request) {
  const userId = await boss(request); if (!userId) return Response.json({ error: "Not found." }, { status: 404 });
  const state = await validateCurrentClaimedSales(userId); return state ? Response.json(state, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Pre-dispatch recovery conditions are not satisfied." }, { status: 409 });
}
export async function POST(request: Request) {
  const userId = await boss(request); if (!userId) return Response.json({ error: "Not found." }, { status: 404 });
  try { const body = await readLimitedJson(request, 1_024); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) return Response.json({ error: "Invalid request." }, { status: 400 }); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const released = await releaseClaimedSalesForOneRetry(userId); if (!released) return Response.json({ error: "Recovery state changed; no provider call was made." }, { status: 409 });
  const result = await executeNextEasyModeTask({ runId: RECOVERY_RUN_ID, userId });
  return Response.json(result, { status: result.state === "completed" ? 200 : 422, headers: { "Cache-Control": "no-store" } });
}
