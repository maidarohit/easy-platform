import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  projectMerchantPaymentAccounts,
  type MerchantOnboardingStatus,
  type MerchantPaymentStatus,
} from "@/app/db/schema";
import {
  fetchRouteLinkedAccount,
  fetchRouteProductConfiguration,
  hostedVerificationUrl,
  MERCHANT_PAYMENT_SUPPORT_MESSAGE,
  MerchantPaymentsNotConfiguredError,
  readActivationStatus,
} from "@/app/lib/merchant-razorpay";

export const MERCHANT_PROVIDER = "razorpay" as const;

export type MerchantPaymentPublicState = Readonly<{
  uiState: "not_connected" | "setup_in_progress" | "under_review" | "active" | "needs_action" | "unavailable";
  onboardingStatus: MerchantOnboardingStatus;
  nextStep: "business" | "stakeholder" | "product" | "settlements" | "verification" | "done" | "unavailable";
  customerMessage: string | null;
  verificationUrl: string | null;
}>;

type AccountRow = typeof projectMerchantPaymentAccounts.$inferSelect;

export async function getMerchantPaymentAccount(projectId: string, userId: string) {
  const [row] = await db
    .select()
    .from(projectMerchantPaymentAccounts)
    .where(and(
      eq(projectMerchantPaymentAccounts.projectId, projectId),
      eq(projectMerchantPaymentAccounts.userId, userId),
      eq(projectMerchantPaymentAccounts.provider, MERCHANT_PROVIDER),
    ))
    .limit(1);
  return row ?? null;
}

export function nextStepFromAccount(row: AccountRow | null): MerchantPaymentPublicState["nextStep"] {
  if (!row || row.onboardingStatus === "not_started") return "business";
  if (row.onboardingStatus === "unavailable") return "unavailable";
  if (row.onboardingStatus === "activated") return "done";
  if (!row.providerAccountId) return "business";
  if (!row.stakeholderId) return "stakeholder";
  if (!row.productConfigurationId) return "product";
  if (row.onboardingStatus === "needs_clarification" || row.status === "needs_action") return "verification";
  if (row.onboardingStatus === "product_requested") return "settlements";
  if (row.onboardingStatus === "settlements_submitted" || row.onboardingStatus === "under_review") return "verification";
  return "verification";
}

export function publicMerchantState(row: AccountRow | null, extras?: { verificationUrl?: string | null }): MerchantPaymentPublicState {
  if (!row) {
    return {
      uiState: "not_connected",
      onboardingStatus: "not_started",
      nextStep: "business",
      customerMessage: null,
      verificationUrl: null,
    };
  }
  const nextStep = nextStepFromAccount(row);
  const uiState: MerchantPaymentPublicState["uiState"] =
    row.status === "unavailable" ? "unavailable"
      : row.status === "active" ? "active"
        : row.status === "under_review" ? "under_review"
          : row.status === "needs_action" ? "needs_action"
            : row.status === "setup_in_progress" ? "setup_in_progress"
              : "not_connected";
  return {
    uiState,
    onboardingStatus: row.onboardingStatus,
    nextStep,
    customerMessage: row.lastErrorMessage,
    verificationUrl: extras?.verificationUrl ?? null,
  };
}

export function mapActivationStatus(activation: string | null): {
  status: MerchantPaymentStatus;
  onboardingStatus: MerchantOnboardingStatus;
} {
  if (activation === "activated") return { status: "active", onboardingStatus: "activated" };
  if (activation === "needs_clarification") return { status: "needs_action", onboardingStatus: "needs_clarification" };
  if (activation === "under_review" || activation === "requested") {
    return { status: "under_review", onboardingStatus: "under_review" };
  }
  if (activation === "rejected") return { status: "needs_action", onboardingStatus: "failed" };
  return { status: "setup_in_progress", onboardingStatus: "product_requested" };
}

export async function persistMerchantAccount(
  projectId: string,
  userId: string,
  values: Partial<typeof projectMerchantPaymentAccounts.$inferInsert> & {
    status: MerchantPaymentStatus;
    onboardingStatus: MerchantOnboardingStatus;
  },
) {
  const existing = await getMerchantPaymentAccount(projectId, userId);
  const payload = {
    ...values,
    lastErrorCode: values.lastErrorCode ?? null,
    lastErrorMessage: values.lastErrorMessage ?? null,
    updatedAt: new Date(),
  };
  if (existing) {
    const [row] = await db
      .update(projectMerchantPaymentAccounts)
      .set(payload)
      .where(and(
        eq(projectMerchantPaymentAccounts.id, existing.id),
        eq(projectMerchantPaymentAccounts.userId, userId),
        eq(projectMerchantPaymentAccounts.projectId, projectId),
      ))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(projectMerchantPaymentAccounts)
    .values({
      projectId,
      userId,
      provider: MERCHANT_PROVIDER,
      ...payload,
    })
    .returning();
  return row;
}

export async function persistRouteUnavailable(projectId: string, userId: string) {
  const existing = await getMerchantPaymentAccount(projectId, userId);
  return persistMerchantAccount(projectId, userId, {
    providerAccountId: existing?.providerAccountId,
    stakeholderId: existing?.stakeholderId,
    productConfigurationId: existing?.productConfigurationId,
    status: "unavailable",
    onboardingStatus: "unavailable",
    lastErrorCode: "ROUTE_UNAVAILABLE",
    lastErrorMessage: MERCHANT_PAYMENT_SUPPORT_MESSAGE,
  });
}

export async function refreshMerchantProductStatus(row: AccountRow) {
  if (!row.providerAccountId || row.onboardingStatus === "unavailable") {
    return { row, verificationUrl: null as string | null };
  }
  try {
    if (row.productConfigurationId) {
      const product = await fetchRouteProductConfiguration(row.providerAccountId, row.productConfigurationId);
      if (!product.ok) {
        if (product.error.code === "ROUTE_UNAVAILABLE") {
          return { row: await persistRouteUnavailable(row.projectId, row.userId), verificationUrl: null };
        }
        return { row, verificationUrl: null };
      }
      const activation = readActivationStatus(product.body);
      const mapped = mapActivationStatus(activation);
      const updated = await persistMerchantAccount(row.projectId, row.userId, {
        providerAccountId: row.providerAccountId,
        stakeholderId: row.stakeholderId,
        productConfigurationId: row.productConfigurationId,
        status: mapped.status,
        onboardingStatus: mapped.onboardingStatus === "product_requested" && row.onboardingStatus === "settlements_submitted"
          ? "settlements_submitted"
          : mapped.onboardingStatus,
      });
      return { row: updated, verificationUrl: hostedVerificationUrl(product.body) };
    }
    const account = await fetchRouteLinkedAccount(row.providerAccountId);
    if (!account.ok && account.error.code === "ROUTE_UNAVAILABLE") {
      return { row: await persistRouteUnavailable(row.projectId, row.userId), verificationUrl: null };
    }
    return { row, verificationUrl: null };
  } catch (error) {
    if (error instanceof MerchantPaymentsNotConfiguredError) {
      return { row: await persistRouteUnavailable(row.projectId, row.userId), verificationUrl: null };
    }
    throw error;
  }
}
