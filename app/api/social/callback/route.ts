import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { verifySocialOAuthState } from "@/app/lib/social-oauth-state";

export async function GET(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; } catch { return Response.json({ error: "Authentication is required." }, { status: 401 }); }
  const parameters = new URL(request.url).searchParams;
  const state = parameters.get("state") ?? "";
  if (!verifySocialOAuthState(state, uid)) return Response.json({ error: "Invalid or expired social connection state." }, { status: 400 });
  return Response.json({ error: "Social publishing setup is not connected yet." }, { status: 503 });
}
