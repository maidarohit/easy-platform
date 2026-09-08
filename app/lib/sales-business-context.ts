import "server-only";

import { loadOwnedBusinessAnalytics } from "@/app/lib/analytics-metrics";
import { loadOwnedMarketingContext } from "@/app/lib/marketing-business-context";

export async function loadOwnedSalesContext(userId: string, projectId: string) {
  const [analytics, presentation] = await Promise.all([
    loadOwnedBusinessAnalytics(userId, projectId),
    loadOwnedMarketingContext(userId, projectId),
  ]);
  if (!analytics || !presentation) return null;
  return {
    project: analytics.project,
    website: presentation.website,
    business: presentation.business,
    metrics: analytics.metrics,
  };
}
