import "server-only";

import {
  buildRouteLinkedAccountBody,
  type ValidMerchantOnboardInput,
} from "@/app/lib/merchant-onboard-validation";

const RAZORPAY_V2 = "https://api.razorpay.com/v2";
const SUPPORT_MESSAGE = "Payment onboarding is not available yet. Please contact Buzypeezy support.";

export const MERCHANT_PAYMENT_SUPPORT_MESSAGE = SUPPORT_MESSAGE;

export class MerchantPaymentsNotConfiguredError extends Error {
  readonly code = "MERCHANT_PAYMENTS_NOT_CONFIGURED";
  constructor() {
    super(SUPPORT_MESSAGE);
    this.name = "MerchantPaymentsNotConfiguredError";
  }
}

export type RazorpayRouteError = Readonly<{
  status: number;
  code: "ROUTE_UNAVAILABLE" | "VALIDATION" | "CONFLICT" | "UPSTREAM";
  customerMessage: string;
  debugMessage?: string;
  providerCode?: string;
  field?: string;
  source?: string;
  step?: string;
  reason?: string;
}>;

function getMerchantRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) throw new MerchantPaymentsNotConfiguredError();
  return { keyId, keySecret };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedErrorText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\r\n\t]/g, " ").trim();
  if (!cleaned) return null;
  if (/authorization|key_secret|basic [a-z0-9+/=]/i.test(cleaned)) return null;
  return cleaned.slice(0, max);
}

export function parseRazorpayClientError(body: unknown): Readonly<{
  description: string;
  code: string | null;
  field: string | null;
  source: string | null;
  step: string | null;
  reason: string | null;
}> {
  const root = asRecord(body);
  const error = asRecord(root?.error) ?? {};
  return {
    description: boundedErrorText(error.description ?? root?.description, 400) ?? "",
    code: boundedErrorText(error.code, 80),
    field: boundedErrorText(error.field ?? root?.field, 80),
    source: boundedErrorText(error.source, 80),
    step: boundedErrorText(error.step, 80),
    reason: boundedErrorText(error.reason, 80),
  };
}

export function razorpayErrorDescription(body: unknown): string {
  return parseRazorpayClientError(body).description;
}

export function razorpayErrorField(body: unknown): string | null {
  return parseRazorpayClientError(body).field;
}

export function merchantOnboardDevelopmentError(error: RazorpayRouteError) {
  if (process.env.NODE_ENV === "production") return {};
  return {
    provider: {
      status: error.status,
      code: error.providerCode ?? null,
      description: error.debugMessage ?? null,
      field: error.field ?? null,
      source: error.source ?? null,
      step: error.step ?? null,
      reason: error.reason ?? null,
    },
  };
}

export function isRouteUnavailable(status: number, body: unknown): boolean {
  const description = razorpayErrorDescription(body).toLowerCase();
  const blob = `${description} ${JSON.stringify(body ?? "").toLowerCase()}`;
  return (
    blob.includes("marketplace feature is not enabled") ||
    blob.includes("route code support feature not enabled") ||
    blob.includes("account_code is not allowed") ||
    blob.includes("invalid type: route") ||
    blob.includes("route is not enabled") ||
    blob.includes("route product is not enabled") ||
    (status === 404 && blob.includes("requested url was not found")) ||
    (status === 400 && blob.includes("requested url was not found"))
  );
}

function classifyRouteError(status: number, body: unknown): RazorpayRouteError {
  if (isRouteUnavailable(status, body)) {
    return { status, code: "ROUTE_UNAVAILABLE", customerMessage: SUPPORT_MESSAGE };
  }
  const parsed = parseRazorpayClientError(body);
  const extras = {
    debugMessage: parsed.description || undefined,
    providerCode: parsed.code ?? undefined,
    field: parsed.field ?? undefined,
    source: parsed.source ?? undefined,
    step: parsed.step ?? undefined,
    reason: parsed.reason ?? undefined,
  };
  const description = parsed.description.toLowerCase();
  if (status === 409 || description.includes("already exists") || description.includes("cannot be more than one")) {
    return {
      status,
      code: "CONFLICT",
      customerMessage: "This payment account is already being set up. Continue from the next step.",
      ...extras,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      status,
      code: "VALIDATION",
      customerMessage: "Please check the details and try again.",
      ...extras,
    };
  }
  return {
    status,
    code: "UPSTREAM",
    customerMessage: "We could not complete this step. Please try again or contact Buzypeezy support.",
    ...extras,
  };
}

async function razorpayRouteRequest(path: string, init: RequestInit): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false; error: RazorpayRouteError }
> {
  const { keyId, keySecret } = getMerchantRazorpayCredentials();
  const response = await fetch(`${RAZORPAY_V2}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    return { ok: false, error: classifyRouteError(response.status, body) };
  }
  const record = asRecord(body);
  if (!record) {
    return {
      ok: false,
      error: {
        status: response.status,
        code: "UPSTREAM",
        customerMessage: "We could not complete this step. Please try again or contact Buzypeezy support.",
      },
    };
  }
  return { ok: true, body: record };
}

export async function createRouteLinkedAccount(input: ValidMerchantOnboardInput) {
  return razorpayRouteRequest("/accounts", {
    method: "POST",
    body: JSON.stringify(buildRouteLinkedAccountBody(input)),
  });
}

export async function fetchRouteLinkedAccount(accountId: string) {
  return razorpayRouteRequest(`/accounts/${encodeURIComponent(accountId)}`, { method: "GET" });
}

export async function createRouteStakeholder(accountId: string, input: Readonly<{
  name: string;
  email: string;
  phone: string;
}>) {
  return razorpayRouteRequest(`/accounts/${encodeURIComponent(accountId)}/stakeholders`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      percentage_ownership: 100,
      relationship: { director: true, executive: true },
      phone: { primary: input.phone, secondary: input.phone },
    }),
  });
}

export async function listRouteStakeholders(accountId: string) {
  return razorpayRouteRequest(`/accounts/${encodeURIComponent(accountId)}/stakeholders`, { method: "GET" });
}

export async function requestRouteProductConfiguration(accountId: string) {
  return razorpayRouteRequest(`/accounts/${encodeURIComponent(accountId)}/products`, {
    method: "POST",
    body: JSON.stringify({ product_name: "route", tnc_accepted: true }),
  });
}

export async function fetchRouteProductConfiguration(accountId: string, productId: string) {
  return razorpayRouteRequest(
    `/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`,
    { method: "GET" },
  );
}

export async function updateRouteProductSettlements(accountId: string, productId: string, input: Readonly<{
  accountNumber: string;
  ifscCode: string;
  beneficiaryName: string;
}>) {
  return razorpayRouteRequest(
    `/accounts/${encodeURIComponent(accountId)}/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        settlements: {
          account_number: input.accountNumber,
          ifsc_code: input.ifscCode,
          beneficiary_name: input.beneficiaryName,
        },
        tnc_accepted: true,
      }),
    },
  );
}

export function readRazorpayId(body: Record<string, unknown>, prefix: string): string | null {
  const id = body.id;
  return typeof id === "string" && id.startsWith(prefix) ? id : null;
}

export function readActivationStatus(body: Record<string, unknown>): string | null {
  const value = body.activation_status;
  return typeof value === "string" ? value : null;
}

export function hostedVerificationUrl(body: Record<string, unknown>): string | null {
  const requirements = body.requirements;
  const list = Array.isArray(requirements) ? requirements : [];
  for (const item of list) {
    const record = asRecord(item);
    const url = record?.resolution_url;
    if (typeof url !== "string") continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" && (parsed.hostname === "razorpay.com" || parsed.hostname.endsWith(".razorpay.com"))) {
        return parsed.toString();
      }
    } catch {
      continue;
    }
  }
  return null;
}
