import "server-only";
import { verifyFirebaseIdTokenAllowUnverified } from "@/app/lib/firebase-admin";
import { isBossAdmin } from "@/app/lib/paid-entitlements";

export const OWNER_COOKIE = "buzypeezy-owner-access";

export async function authorizePlatformOwner(request: Request) {
  try {
    const token = await verifyFirebaseIdTokenAllowUnverified(request);
    if (!isBossAdmin(token.uid)) return { status: 403 as const };
    return { status: 200 as const, token };
  } catch {
    return { status: 401 as const };
  }
}

export async function authorizePlatformOwnerCookie(value: string | undefined) {
  if (!value) return { status: 401 as const };
  return authorizePlatformOwner(new Request("https://owner-access.internal", {
    headers: { authorization: `Bearer ${value}` },
  }));
}
