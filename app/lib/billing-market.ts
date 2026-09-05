import "server-only";

import { marketForCountry, type BillingMarket } from "@/app/lib/billing-plans";

export const TRUSTED_COUNTRY_HEADER = "x-vercel-ip-country";

export function billingMarketFromHeaders(headers: Pick<Headers, "get">): BillingMarket {
  return marketForCountry(headers.get(TRUSTED_COUNTRY_HEADER));
}
