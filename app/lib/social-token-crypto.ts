import "server-only";

import { createCipheriv, randomBytes } from "node:crypto";

export function encryptSocialToken(token: string) {
  const encodedKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  const key = encodedKey ? Buffer.from(encodedKey, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_NOT_CONFIGURED");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}
