import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { freeWebsitePreviews, projectOutputs, projects } from "@/app/db/schema";

const CLAIM_LEASE_MS = 3 * 60 * 1000;

export type FreeWebsitePreviewClaim = Readonly<{ token: string; projectId: string }>;

export async function persistSuccessfulFreeWebsitePreview(
  userId: string,
  claim: FreeWebsitePreviewClaim,
  result: string,
  dependencies: Readonly<{
    save: typeof saveFreeWebsitePreview;
    release: typeof releaseFreeWebsitePreview;
  }> = { save: saveFreeWebsitePreview, release: releaseFreeWebsitePreview },
) {
  try {
    return await dependencies.save(userId, claim, result);
  } catch (error) {
    await dependencies.release(userId, claim);
    throw error;
  }
}

export async function claimFreeWebsitePreview(userId: string, projectId: string): Promise<FreeWebsitePreviewClaim | null | undefined> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`free-website-preview:${userId}`}))`);
    const [owned] = await transaction.select({ id: projects.id }).from(projects).where(and(
      eq(projects.id, projectId), eq(projects.userId, userId),
    )).limit(1);
    if (!owned) return undefined;

    const [savedWebsite] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.userId, userId), eq(projectOutputs.module, "website"),
    )).limit(1);
    if (savedWebsite) return null;

    const [existing] = await transaction.select().from(freeWebsitePreviews)
      .where(eq(freeWebsitePreviews.userId, userId)).limit(1).for("update");
    const now = new Date();
    if (existing?.status === "used" || (existing?.status === "claimed" && existing.leaseExpiresAt > now)) return null;
    const token = randomUUID();
    const values = { projectId, claimToken: token, status: "claimed" as const, leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS), usedAt: null, updatedAt: now };
    if (existing) await transaction.update(freeWebsitePreviews).set(values).where(eq(freeWebsitePreviews.id, existing.id));
    else await transaction.insert(freeWebsitePreviews).values({ userId, ...values });
    return { token, projectId };
  });
}

export async function releaseFreeWebsitePreview(userId: string, claim: FreeWebsitePreviewClaim) {
  await db.delete(freeWebsitePreviews).where(and(
    eq(freeWebsitePreviews.userId, userId), eq(freeWebsitePreviews.projectId, claim.projectId),
    eq(freeWebsitePreviews.claimToken, claim.token), eq(freeWebsitePreviews.status, "claimed"),
  ));
}

export async function saveFreeWebsitePreview(userId: string, claim: FreeWebsitePreviewClaim, result: string) {
  return db.transaction(async (transaction) => {
    const [record] = await transaction.select().from(freeWebsitePreviews).where(and(
      eq(freeWebsitePreviews.userId, userId), eq(freeWebsitePreviews.projectId, claim.projectId),
      eq(freeWebsitePreviews.claimToken, claim.token), eq(freeWebsitePreviews.status, "claimed"),
    )).limit(1).for("update");
    if (!record) return false;
    const [existingOutput] = await transaction.select({ id: projectOutputs.id }).from(projectOutputs).where(and(
      eq(projectOutputs.projectId, claim.projectId), eq(projectOutputs.userId, userId), eq(projectOutputs.module, "website"),
    )).limit(1);
    const now = new Date();
    if (existingOutput) await transaction.update(projectOutputs).set({ result, approvedAt: null, updatedAt: now }).where(eq(projectOutputs.id, existingOutput.id));
    else await transaction.insert(projectOutputs).values({ projectId: claim.projectId, userId, module: "website", result });
    await transaction.update(freeWebsitePreviews).set({ status: "used", usedAt: now, updatedAt: now })
      .where(and(eq(freeWebsitePreviews.id, record.id), eq(freeWebsitePreviews.claimToken, claim.token)));
    return true;
  });
}
