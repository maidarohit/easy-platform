export function shouldShowBusinessPlanBadge(
  businessPlan: boolean | undefined,
  paidAccess: boolean | null,
) {
  return businessPlan === true && paidAccess === false;
}
