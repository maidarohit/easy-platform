export const AI_USAGE_RECONCILIATION_MAX_ATTEMPTS = 6;

export type ReconciliationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "exhausted";

export function canClaimReconciliation(status: ReconciliationStatus) {
  return status === "pending" || status === "processing";
}

export function retryStatus(attemptCount: number): "pending" | "exhausted" {
  return attemptCount >= AI_USAGE_RECONCILIATION_MAX_ATTEMPTS
    ? "exhausted"
    : "pending";
}
