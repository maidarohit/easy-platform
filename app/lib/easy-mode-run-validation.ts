import "server-only";

import { isEasyModeGoalId, type EasyModeGoalId } from "@/app/lib/easy-mode-goal-options";

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EasyModeRunCreateBody = {
  projectId: string;
  goalId: EasyModeGoalId;
  idempotencyKey: string;
};

export function validateEasyModeRunCreateBody(value: unknown): EasyModeRunCreateBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["projectId", "goalId", "idempotencyKey"].includes(key))) return null;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!PROJECT_ID_PATTERN.test(projectId) || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) || !isEasyModeGoalId(body.goalId)) return null;
  return { projectId, goalId: body.goalId, idempotencyKey };
}

export function validateEasyModeRunId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}
