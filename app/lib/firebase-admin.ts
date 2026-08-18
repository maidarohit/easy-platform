import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

export async function verifyFirebaseIdToken(
  request: Request
): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization")?.trim();
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);

  if (!match) {
    throw new Error("A valid Authorization: Bearer <token> header is required.");
  }

  return getAuth(getFirebaseAdminApp()).verifyIdToken(match[1]);
}
