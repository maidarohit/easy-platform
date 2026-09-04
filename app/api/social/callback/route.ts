import { and, eq } from "drizzle-orm";
import { db } from "@/app/db";
import { projects, socialConnections } from "@/app/db/schema";
import { exchangeMetaCode, MetaOAuthError } from "@/app/lib/meta-oauth";
import { verifySocialOAuthState } from "@/app/lib/social-oauth-state";
import { encryptSocialToken } from "@/app/lib/social-token-crypto";

function socialRedirect(request: Request, projectId: string, result: "connected" | "error", reason?: string) {
  const url = new URL("/social", request.url);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("connection", result);
  if (reason) url.searchParams.set("reason", reason);
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const state = verifySocialOAuthState(parameters.get("state") ?? "");
  if (!state) return Response.json({ error: "Invalid or expired social connection state." }, { status: 400 });
  if (state.provider !== "meta") return Response.json({ error: "This social provider is not available yet." }, { status: 503 });
  if (parameters.get("error")) {
    console.warn("Meta OAuth was declined or failed:", parameters.get("error_reason") ?? parameters.get("error"));
    return socialRedirect(request, state.projectId, "error", "authorization_denied");
  }
  const code = parameters.get("code")?.trim();
  if (!code) return socialRedirect(request, state.projectId, "error", "missing_code");

  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, state.projectId), eq(projects.userId, state.uid))).limit(1);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  try {
    const connection = await exchangeMetaCode(code);
    const encryptedToken = encryptSocialToken(connection.accessToken);
    const now = new Date();
    await db.insert(socialConnections).values({
      projectId: state.projectId, userId: state.uid, provider: "meta",
      providerAccountId: connection.providerAccountId, accountName: connection.accountName,
      accessTokenEncrypted: encryptedToken, status: "connected", connectedAt: now,
      expiresAt: connection.expiresAt, updatedAt: now,
    }).onConflictDoUpdate({
      target: [socialConnections.projectId, socialConnections.provider],
      set: {
        userId: state.uid, providerAccountId: connection.providerAccountId,
        accountName: connection.accountName, accessTokenEncrypted: encryptedToken,
        status: "connected", connectedAt: now, expiresAt: connection.expiresAt, updatedAt: now,
      },
    });
    return socialRedirect(request, state.projectId, "connected");
  } catch (error) {
    console.error("Meta OAuth callback failed:", error instanceof Error ? error.message : "Unknown error");
    const reason = error instanceof MetaOAuthError ? "meta_authorization_failed" : "connection_failed";
    return socialRedirect(request, state.projectId, "error", reason);
  }
}
