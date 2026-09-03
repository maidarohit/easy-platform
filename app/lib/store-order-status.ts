export const OWNER_ORDER_STATUSES = ["pending", "confirmed", "fulfilled", "cancelled"] as const;
export type OwnerOrderStatus = (typeof OWNER_ORDER_STATUSES)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<OwnerOrderStatus, readonly OwnerOrderStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

export function isOwnerOrderStatus(value: unknown): value is OwnerOrderStatus {
  return typeof value === "string" && (OWNER_ORDER_STATUSES as readonly string[]).includes(value);
}

export function allowedOwnerOrderTransitions(from: OwnerOrderStatus): readonly OwnerOrderStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

export function canTransitionOwnerOrderStatus(from: OwnerOrderStatus, to: OwnerOrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function ownerOrderStatusUpdateError(from: OwnerOrderStatus, to: OwnerOrderStatus): string {
  if (from === to) return "This order is already in that status.";
  if (from === "fulfilled" || from === "cancelled") return "This order can no longer be updated.";
  return "That status change is not allowed.";
}
