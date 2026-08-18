import "server-only";

import { db } from "@/app/db";
import {
  aiUsage,
  aiUsageReconciliations,
  type AiUsageReconciliationStatus,
} from "@/app/db/schema";
import { enrichAiUsage } from "@/app/lib/ai-usage";
import { retryStatus } from "@/app/lib/ai-reconciliation-policy";
import { fetchN8nExecutionUsage } from "@/app/lib/n8n-executions";
import { and, eq, inArray } from "drizzle-orm";

const MAX_BATCH_SIZE = 10;
const STALE_PROCESSING_MS = 10 * 60_000;

export async function associateN8nExecution({
  usageId,
  executionId,
  metadataAlreadyApplied,
}: {
  usageId: string;
  executionId: string;
  metadataAlreadyApplied: boolean;
}): Promise<void> {
  const now = new Date();

  await db
    .insert(aiUsageReconciliations)
    .values({
      usageId,
      n8nExecutionId: executionId,
      status: metadataAlreadyApplied ? "completed" : "pending",
      completedAt: metadataAlreadyApplied ? now : null,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

function retryDelayMs(attemptCount: number) {
  return Math.min(
    60 * 60_000,
    30_000 * 2 ** Math.max(0, attemptCount - 1)
  );
}

function isDue(
  row: {
    status: AiUsageReconciliationStatus;
    attemptCount: number;
    lastAttemptAt: Date | null;
  },
  now: Date
) {
  if (!row.lastAttemptAt) return true;

  const age = now.getTime() - row.lastAttemptAt.getTime();

  return row.status === "processing"
    ? age >= STALE_PROCESSING_MS
    : age >= retryDelayMs(row.attemptCount);
}

async function finishAttempt(
  id: string,
  status: "completed" | "pending" | "exhausted"
) {
  const now = new Date();

  await db
    .update(aiUsageReconciliations)
    .set({
      status,
      completedAt: status === "completed" ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiUsageReconciliations.id, id),
        eq(aiUsageReconciliations.status, "processing")
      )
    );
}

async function getUsageWorkflow(
  usageId: string
): Promise<string | null> {
  const [usage] = await db
    .select({
      workflow: aiUsage.workflow,
    })
    .from(aiUsage)
    .where(eq(aiUsage.id, usageId))
    .limit(1);

  const workflow = usage?.workflow?.trim();

  return workflow || null;
}

export async function reconcilePendingAiUsage() {
  const now = new Date();

  const candidates = await db
    .select()
    .from(aiUsageReconciliations)
    .where(
      inArray(aiUsageReconciliations.status, [
        "pending",
        "processing",
      ])
    )
    .limit(100);

  let processed = 0;
  let completed = 0;

  for (const candidate of candidates) {
    if (
      processed >= MAX_BATCH_SIZE ||
      !isDue(candidate, now)
    ) {
      continue;
    }

    const [claimed] = await db
      .update(aiUsageReconciliations)
      .set({
        status: "processing",
        attemptCount: candidate.attemptCount + 1,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiUsageReconciliations.id, candidate.id),
          eq(
            aiUsageReconciliations.status,
            candidate.status
          ),
          eq(
            aiUsageReconciliations.attemptCount,
            candidate.attemptCount
          )
        )
      )
      .returning();

    if (!claimed) continue;

    processed += 1;

    try {
      const workflow = await getUsageWorkflow(
        claimed.usageId
      );

      if (!workflow) {
        await finishAttempt(
          claimed.id,
          "exhausted"
        );
        continue;
      }

      const result = await fetchN8nExecutionUsage(
        claimed.n8nExecutionId,
        workflow
      );

      if (result.state === "ready") {
        await enrichAiUsage({
          usageId: claimed.usageId,
          usageComponents: [result.component],
        });

        await finishAttempt(
          claimed.id,
          "completed"
        );

        completed += 1;
      } else {
        await finishAttempt(
          claimed.id,
          result.state === "rejected"
            ? "exhausted"
            : retryStatus(claimed.attemptCount)
        );
      }
    } catch {
      await finishAttempt(
        claimed.id,
        retryStatus(claimed.attemptCount)
      );
    }
  }

  return {
    processed,
    completed,
  };
}

/*
  Temporary compatibility export.

  The internal reconciliation API currently imports the old
  Content-AI-specific function name. Keeping this alias means
  Content AI continues working while the reconciler itself is
  now generic across workflows.
*/
export const reconcilePendingContentAiUsage =
  reconcilePendingAiUsage;