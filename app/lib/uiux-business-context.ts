import "server-only";

import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";

export async function loadOwnedUiuxContext(userId: string, projectId: string) {
  const context = await loadOwnedMarketingContext(userId, projectId);
  if (!context) return null;
  return {
    website: context.website,
    business: context.business,
  };
}

export type UiuxBusinessContext = NonNullable<Awaited<ReturnType<typeof loadOwnedUiuxContext>>>;
