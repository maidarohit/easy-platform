import "server-only";

const META_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic"];

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

type MetaErrorBody = { error?: { code?: number } };

export class MetaOAuthError extends Error {
  constructor(public readonly publicMessage: string, message: string) {
    super(message);
  }
}

function configuration() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
  if (!configId) {
  throw new Error("META_LOGIN_CONFIG_ID is not configured.");
}
  if (!appId || !appSecret || !redirectUri || !version || !/^v\d+\.\d+$/.test(version)) {
    throw new MetaOAuthError("Meta connection is not configured.", "META_OAUTH_NOT_CONFIGURED");
  }
  return { appId, appSecret, redirectUri, version, configId };
}

async function metaJson<T>(url: URL, label: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const body = await response.json().catch(() => null) as (T & MetaErrorBody) | null;
  if (!response.ok || !body || body.error) {
    const code = body?.error?.code;
    throw new MetaOAuthError("Meta could not authorize this connection.", `${label}${code ? ` (${code})` : ""}`);
  }
  return body;
}

export function metaAuthorizationUrl(state: string) {
  const { appId, redirectUri, version, configId } = configuration();
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeMetaCode(code: string) {
  const { appId, appSecret, redirectUri, version } = configuration();
  const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const shortToken = await metaJson<{ access_token: string }>(tokenUrl, "META_CODE_EXCHANGE_FAILED");
  if (!shortToken.access_token) throw new MetaOAuthError("Meta did not return an access token.", "META_TOKEN_MISSING");

  const longTokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
  longTokenUrl.searchParams.set("client_id", appId);
  longTokenUrl.searchParams.set("client_secret", appSecret);
  longTokenUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
  const token = await metaJson<{ access_token: string; expires_in?: number }>(longTokenUrl, "META_LONG_TOKEN_EXCHANGE_FAILED");
  if (!token.access_token) throw new MetaOAuthError("Meta did not return an access token.", "META_LONG_TOKEN_MISSING");

  const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("limit", "100");
  pagesUrl.searchParams.set("access_token", token.access_token);
  const pages = await metaJson<{ data?: MetaPage[] }>(pagesUrl, "META_PAGES_LOOKUP_FAILED");
  const available = (pages.data ?? []).filter((page) => page.id && page.name && page.access_token);
  if (available.length === 0) throw new MetaOAuthError("No Facebook Page is available for this Meta account.", "META_PAGE_NOT_FOUND");

  const page = available.find((item) => item.instagram_business_account?.id) ?? available[0];
  const instagram = page.instagram_business_account;
  return {
    providerAccountId: instagram?.id ?? page.id,
    accountName: instagram ? `${instagram.username ? `@${instagram.username}` : "Instagram"} · ${page.name}` : page.name,
    accessToken: page.access_token,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
  };
}
