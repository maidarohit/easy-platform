import { NextResponse } from "next/server";

import { validateMerchantOnboardPayload, merchantOnboardCanRetry } from "@/app/lib/merchant-onboard-validation";
import {
  getMerchantPaymentAccount,
  persistMerchantAccount,
  persistRouteUnavailable,
  publicMerchantState,
} from "@/app/lib/merchant-payment";
import {
  createRouteLinkedAccount,
  MerchantPaymentsNotConfiguredError,
  merchantOnboardDevelopmentError,
  readRazorpayId,
} from "@/app/lib/merchant-razorpay";
import { requireOwnedStoreProject } from "@/app/lib/store-project-auth";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const projectId = text(body.projectId, 128);
  const owner = await requireOwnedStoreProject(request, projectId);
  if (owner.error) return NextResponse.json({ error: owner.error }, { status: owner.status });
  const userId = owner.userId!;

  const existing = await getMerchantPaymentAccount(projectId, userId);
  if (!merchantOnboardCanRetry(existing)) {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }

  const checked = validateMerchantOnboardPayload(body);
  if (!checked.valid) {
    return NextResponse.json({ error: checked.error, field: checked.field }, { status: 400 });
  }

  try {
    const created = await createRouteLinkedAccount(checked.value);
    if (!created.ok) {
      if (created.error.code === "ROUTE_UNAVAILABLE") {
        const row = await persistRouteUnavailable(projectId, userId);
        return NextResponse.json({ payment: publicMerchantState(row) });
      }
      const row = await persistMerchantAccount(projectId, userId, {
        status: "needs_action",
        onboardingStatus: "failed",
        lastErrorCode: created.error.code,
        lastErrorMessage: created.error.customerMessage,
      });
      return NextResponse.json({
        payment: publicMerchantState(row),
        error: created.error.customerMessage,
        ...merchantOnboardDevelopmentError(created.error),
      }, { status: 400 });
    }
    const accountId = readRazorpayId(created.body, "acc_");
    if (!accountId) {
      const row = await persistMerchantAccount(projectId, userId, {
        status: "needs_action",
        onboardingStatus: "failed",
        lastErrorCode: "UPSTREAM",
        lastErrorMessage: "We could not complete this step. Please try again or contact Buzypeezy support.",
      });
      return NextResponse.json({ payment: publicMerchantState(row) }, { status: 502 });
    }
    const row = await persistMerchantAccount(projectId, userId, {
      providerAccountId: accountId,
      status: "setup_in_progress",
      onboardingStatus: "account_created",
    });
    return NextResponse.json({ payment: publicMerchantState(row) });
  } catch (error) {
    if (error instanceof MerchantPaymentsNotConfiguredError) {
      const row = await persistRouteUnavailable(projectId, userId);
      return NextResponse.json({ payment: publicMerchantState(row) });
    }
    throw error;
  }
}
