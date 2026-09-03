import { NextResponse } from "next/server";

import {
  getMerchantPaymentAccount,
  mapActivationStatus,
  persistMerchantAccount,
  persistRouteUnavailable,
  publicMerchantState,
} from "@/app/lib/merchant-payment";
import {
  hostedVerificationUrl,
  MerchantPaymentsNotConfiguredError,
  readActivationStatus,
  readRazorpayId,
  requestRouteProductConfiguration,
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
  if (!existing?.providerAccountId || !existing.stakeholderId) {
    return NextResponse.json({ error: "Complete the previous payment setup steps first." }, { status: 409 });
  }
  if (existing.onboardingStatus === "unavailable") {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }
  if (existing.productConfigurationId) {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }
  if (body.tncAccepted !== true) {
    return NextResponse.json({ error: "Please accept the payment terms to continue." }, { status: 400 });
  }

  try {
    const requested = await requestRouteProductConfiguration(existing.providerAccountId);
    if (!requested.ok) {
      if (requested.error.code === "ROUTE_UNAVAILABLE") {
        return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
      }
      const row = await persistMerchantAccount(projectId, userId, {
        providerAccountId: existing.providerAccountId,
        stakeholderId: existing.stakeholderId,
        status: "needs_action",
        onboardingStatus: existing.onboardingStatus,
        lastErrorCode: requested.error.code,
        lastErrorMessage: requested.error.customerMessage,
      });
      return NextResponse.json({ payment: publicMerchantState(row) }, { status: 400 });
    }
    const productId = readRazorpayId(requested.body, "acc_prd_") ?? readRazorpayId(requested.body, "prd_");
    if (!productId) {
      return NextResponse.json({ error: "We could not complete this step. Please try again or contact Buzypeezy support." }, { status: 502 });
    }
    const mapped = mapActivationStatus(readActivationStatus(requested.body));
    const row = await persistMerchantAccount(projectId, userId, {
      providerAccountId: existing.providerAccountId,
      stakeholderId: existing.stakeholderId,
      productConfigurationId: productId,
      status: mapped.status === "active" ? "active" : "setup_in_progress",
      onboardingStatus: mapped.onboardingStatus === "activated" ? "activated" : "product_requested",
    });
    return NextResponse.json({
      payment: publicMerchantState(row, { verificationUrl: hostedVerificationUrl(requested.body) }),
    });
  } catch (error) {
    if (error instanceof MerchantPaymentsNotConfiguredError) {
      return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
    }
    throw error;
  }
}
