import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SocialProviderName } from "@/app/lib/social-provider";

type StatePayload = { uid: string; projectId: string; provider: SocialProviderName; nonce: string; expiresAt: number };
const encode = (value: string) => Buffer.from(value).toString("base64url");

export function createSocialOAuthState(input: Omit<StatePayload, "nonce" | "expiresAt">, now = Date.now()) {
  const secret = process.env.SOCIAL_OAUTH_STATE_SECRET;
  if (!secret || secret.length < 32) throw new Error("SOCIAL_OAUTH_NOT_CONFIGURED");
  const payload: StatePayload = { ...input, nonce: randomBytes(24).toString("hex"), expiresAt: now + 10 * 60 * 1000 };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

export function verifySocialOAuthState(state: string, expectedUid: string, now = Date.now()): StatePayload | null {
  const secret = process.env.SOCIAL_OAUTH_STATE_SECRET;
  const [encoded, signature, extra] = state.split(".");
  if (!secret || !encoded || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StatePayload;
    return payload.uid === expectedUid && payload.expiresAt >= now && (payload.provider === "meta" || payload.provider === "linkedin") ? payload : null;
  } catch { return null; }
}
