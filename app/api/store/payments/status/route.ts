import { NextResponse } from "next/server";

import {
  getMerchantPaymentAccount,
  publicMerchantState,
  refreshMerchantProductStatus,
} from "@/app/lib/merchant-payment";
import { requireOwnedStoreProject } from "@/app/lib/store-project-auth";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  const owner = await requireOwnedStoreProject(request, projectId);
  if (owner.error) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const existing = await getMerchantPaymentAccount(owner.projectId, owner.userId!);
  if (!existing) return NextResponse.json({ payment: publicMerchantState(null) });

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  if (!refresh) return NextResponse.json({ payment: publicMerchantState(existing) });

  const { row, verificationUrl } = await refreshMerchantProductStatus(existing);
  return NextResponse.json({ payment: publicMerchantState(row, { verificationUrl }) });
}
