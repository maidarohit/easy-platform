export const SUBSCRIPTION_REQUIRED_CODE = "PAID_SUBSCRIPTION_REQUIRED";
export const SUBSCRIPTION_REQUIRED_EVENT = "buzypeezy:subscription-required";

export type SubscriptionRequiredDetail = Readonly<{
  returnTo: string;
  projectId?: string;
}>;

export async function isSubscriptionRequiredResponse(response: Response) {
  if (response.status !== 403) return false;
  try {
    const body = await response.clone().json() as { code?: unknown };
    return body.code === SUBSCRIPTION_REQUIRED_CODE;
  } catch {
    return false;
  }
}

function projectIdFromRequest(input: RequestInfo | URL, init: RequestInit) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = new URL(raw, window.location.origin);
    const queryProjectId = url.searchParams.get("projectId")?.trim();
    if (queryProjectId) return queryProjectId;
  } catch {}
  if (typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body) as { projectId?: unknown };
      if (typeof body.projectId === "string" && body.projectId.trim()) return body.projectId.trim();
    } catch {}
  }
  return new URLSearchParams(window.location.search).get("projectId")?.trim() || undefined;
}

export async function announceSubscriptionRequired(
  response: Response,
  input: RequestInfo | URL,
  init: RequestInit,
) {
  if (typeof window === "undefined" || !(await isSubscriptionRequiredResponse(response))) return;
  const detail: SubscriptionRequiredDetail = {
    returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    projectId: projectIdFromRequest(input, init),
  };
  window.dispatchEvent(new CustomEvent<SubscriptionRequiredDetail>(SUBSCRIPTION_REQUIRED_EVENT, { detail }));
}
