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
  updateRouteProductSettlements,
} from "@/app/lib/merchant-razorpay";
import { requireOwnedStoreProject } from "@/app/lib/store-project-auth";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

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
  if (!existing?.providerAccountId || !existing.productConfigurationId) {
    return NextResponse.json({ error: "Complete the previous payment setup steps first." }, { status: 409 });
  }
  if (existing.onboardingStatus === "unavailable") {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }
  if (existing.status === "active") {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }

  const accountNumber = text(body.accountNumber, 20).replace(/\s/g, "");
  const ifscCode = text(body.ifscCode, 11).toUpperCase();
  const beneficiaryName = text(body.beneficiaryName, 120);
  if (!/^[0-9]{5,20}$/.test(accountNumber) || !IFSC.test(ifscCode) || beneficiaryName.length < 4) {
    return NextResponse.json({ error: "Enter a valid bank account number, IFSC and beneficiary name." }, { status: 400 });
  }

  try {
    const updated = await updateRouteProductSettlements(
      existing.providerAccountId,
      existing.productConfigurationId,
      { accountNumber, ifscCode, beneficiaryName },
    );
    if (!updated.ok) {
      if (updated.error.code === "ROUTE_UNAVAILABLE") {
        return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
      }
      const row = await persistMerchantAccount(projectId, userId, {
        providerAccountId: existing.providerAccountId,
        stakeholderId: existing.stakeholderId,
        productConfigurationId: existing.productConfigurationId,
        status: "needs_action",
        onboardingStatus: existing.onboardingStatus,
        lastErrorCode: updated.error.code,
        lastErrorMessage: updated.error.customerMessage,
      });
      return NextResponse.json({ payment: publicMerchantState(row) }, { status: 400 });
    }
    const mapped = mapActivationStatus(readActivationStatus(updated.body));
    const row = await persistMerchantAccount(projectId, userId, {
      providerAccountId: existing.providerAccountId,
      stakeholderId: existing.stakeholderId,
      productConfigurationId: existing.productConfigurationId,
      status: mapped.status,
      onboardingStatus: mapped.onboardingStatus === "product_requested" ? "settlements_submitted" : mapped.onboardingStatus,
    });
    return NextResponse.json({
      payment: publicMerchantState(row, { verificationUrl: hostedVerificationUrl(updated.body) }),
    });
  } catch (error) {
    if (error instanceof MerchantPaymentsNotConfiguredError) {
      return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
    }
    throw error;
  }
}
