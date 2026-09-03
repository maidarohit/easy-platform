import { NextResponse } from "next/server";

import {
  getMerchantPaymentAccount,
  persistMerchantAccount,
  persistRouteUnavailable,
  publicMerchantState,
} from "@/app/lib/merchant-payment";
import {
  createRouteStakeholder,
  listRouteStakeholders,
  MerchantPaymentsNotConfiguredError,
  readRazorpayId,
} from "@/app/lib/merchant-razorpay";
import { requireOwnedStoreProject } from "@/app/lib/store-project-auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function firstStakeholderId(body: Record<string, unknown>): string | null {
  const id = readRazorpayId(body, "sth_");
  if (id) return id;
  const items = Array.isArray(body.items) ? body.items
    : Array.isArray(body.stakeholders) ? body.stakeholders
      : Array.isArray(body) ? body
        : [];
  for (const item of items) {
    if (item && typeof item === "object") {
      const found = readRazorpayId(item as Record<string, unknown>, "sth_");
      if (found) return found;
    }
  }
  return null;
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
  if (!existing?.providerAccountId) {
    return NextResponse.json({ error: "Set up business details first." }, { status: 409 });
  }
  if (existing.onboardingStatus === "unavailable") {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }
  if (existing.stakeholderId) {
    return NextResponse.json({ payment: publicMerchantState(existing) });
  }

  const name = text(body.name, 255);
  const email = text(body.email, 254).toLowerCase();
  const phone = digits(body.phone);
  if (name.length < 4 || !EMAIL_PATTERN.test(email) || phone.length < 8 || phone.length > 15) {
    return NextResponse.json({ error: "Enter a valid stakeholder name, email and phone." }, { status: 400 });
  }

  try {
    const created = await createRouteStakeholder(existing.providerAccountId, { name, email, phone });
    if (!created.ok) {
      if (created.error.code === "ROUTE_UNAVAILABLE") {
        return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
      }
      if (created.error.code === "CONFLICT") {
        const listed = await listRouteStakeholders(existing.providerAccountId);
        const stakeholderId = listed.ok ? firstStakeholderId(listed.body) : null;
        if (stakeholderId) {
          const row = await persistMerchantAccount(projectId, userId, {
            providerAccountId: existing.providerAccountId,
            stakeholderId,
            productConfigurationId: existing.productConfigurationId,
            status: "setup_in_progress",
            onboardingStatus: "stakeholder_created",
          });
          return NextResponse.json({ payment: publicMerchantState(row) });
        }
      }
      const row = await persistMerchantAccount(projectId, userId, {
        providerAccountId: existing.providerAccountId,
        status: "needs_action",
        onboardingStatus: existing.onboardingStatus,
        lastErrorCode: created.error.code,
        lastErrorMessage: created.error.customerMessage,
      });
      return NextResponse.json({ payment: publicMerchantState(row) }, { status: 400 });
    }
    const stakeholderId = firstStakeholderId(created.body);
    if (!stakeholderId) {
      return NextResponse.json({ error: "We could not complete this step. Please try again or contact Buzypeezy support." }, { status: 502 });
    }
    const row = await persistMerchantAccount(projectId, userId, {
      providerAccountId: existing.providerAccountId,
      stakeholderId,
      status: "setup_in_progress",
      onboardingStatus: "stakeholder_created",
    });
    return NextResponse.json({ payment: publicMerchantState(row) });
  } catch (error) {
    if (error instanceof MerchantPaymentsNotConfiguredError) {
      return NextResponse.json({ payment: publicMerchantState(await persistRouteUnavailable(projectId, userId)) });
    }
    throw error;
  }
}
