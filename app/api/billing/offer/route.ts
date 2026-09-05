import { BILLING_PLAN } from "@/app/lib/billing-plans";
import { billingMarketFromHeaders } from "@/app/lib/billing-market";

export async function GET(request: Request) {
  const market = billingMarketFromHeaders(request.headers);
  return Response.json(
    { market, ...BILLING_PLAN.prices[market] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
