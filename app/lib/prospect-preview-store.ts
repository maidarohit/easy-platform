import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { aiUsage, projectOutputs, projects, prospectPreviews, prospectPreviewRateLimits, users } from "@/app/db/schema";
import { buildAiUsageCompletionUpdate } from "@/app/lib/ai-usage";
import type { AiUsageComponent } from "@/app/lib/ai-usage-metadata";
import { validateWebsiteSiteDocument } from "@/app/lib/website-site-document";
import { hashProspectValue, PROSPECT_CONCURRENCY, PROSPECT_DAILY_GENERATIONS, PROSPECT_LEASE_MS,
  PROSPECT_OWNER_EMAIL, PROSPECT_OWNER_ID, PROSPECT_REQUESTS_PER_MINUTE, prospectPreviewAccessible,
  validProspectPreviewToken, type ProspectDraft, type ProspectInput } from "@/app/lib/prospect-preview-core";

export type ProspectRecord = typeof prospectPreviews.$inferSelect;
export type ProspectClaim = { kind: "created" | "existing"; record: ProspectRecord } | { kind: "conflict" } | { kind: "limited"; retryAfter: number };

export function createProspectPreviewStore(database = db) {
  return {
    async rateLimit() {
      return database.transaction(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5s'`);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('prospect-preview-rate'))`);
        const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
        const now = new Date(clock.now);
        const [rate] = await tx.select().from(prospectPreviewRateLimits).where(eq(prospectPreviewRateLimits.key, "internal"));
        if (!rate || now.getTime() - rate.windowStartedAt.getTime() >= 60_000) {
          await tx.insert(prospectPreviewRateLimits).values({ key: "internal", windowStartedAt: now, count: 1 })
            .onConflictDoUpdate({ target: prospectPreviewRateLimits.key, set: { windowStartedAt: now, count: 1 } });
          return 0;
        }
        if (rate.count >= PROSPECT_REQUESTS_PER_MINUTE) return Math.max(1, Math.ceil((rate.windowStartedAt.getTime() + 60_000 - now.getTime()) / 1000));
        await tx.update(prospectPreviewRateLimits).set({ count: rate.count + 1 }).where(eq(prospectPreviewRateLimits.key, "internal"));
        return 0;
      });
    },
    async claim(key: string, payloadHash: string, input: ProspectInput): Promise<ProspectClaim> {
      return database.transaction(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5s'`);
        // One short global reservation lock covers idempotency, quota and ownership.
        // No network calls run inside this transaction.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('prospect-preview-generation'))`);
        const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
        const now = new Date(clock.now);
        const [existing] = await tx.select().from(prospectPreviews).where(eq(prospectPreviews.idempotencyKey, key));
        if (existing) {
          if (existing.payloadHash !== payloadHash) return { kind: "conflict" };
          if (existing.status === "processing" && existing.leaseExpiresAt <= now) {
            await tx.update(prospectPreviews).set({ status: "failed", errorCategory: "interrupted", updatedAt: now }).where(eq(prospectPreviews.id, existing.id));
            await tx.update(aiUsage).set({ status: "failed" }).where(eq(aiUsage.id, existing.usageId));
            return { kind: "existing", record: { ...existing, status: "failed", errorCategory: "interrupted" } };
          }
          return { kind: "existing", record: existing };
        }
        const [quota] = await tx.execute<{ active: number; daily: number }>(sql`
          select count(*) filter (where status <> 'ready' and lease_expires_at > ${now.toISOString()}::timestamptz)::int as active,
            count(*) filter (where created_at > ${now.toISOString()}::timestamptz - interval '24 hours')::int as daily
          from prospect_previews`);
        if (quota.active >= PROSPECT_CONCURRENCY) return { kind: "limited", retryAfter: 180 };
        if (quota.daily >= PROSPECT_DAILY_GENERATIONS) return { kind: "limited", retryAfter: 3600 };
        await tx.insert(users).values({ id: PROSPECT_OWNER_ID, email: PROSPECT_OWNER_EMAIL }).onConflictDoNothing();
        const [owner] = await tx.select().from(users).where(eq(users.id, PROSPECT_OWNER_ID));
        if (owner?.email !== PROSPECT_OWNER_EMAIL) throw new Error("INTERNAL_OWNER_CONFLICT");
        const projectId = randomUUID();
        await tx.insert(projects).values({ id: projectId, userId: PROSPECT_OWNER_ID,
          name: input.companyName, companyName: input.companyName, industry: input.businessType,
          brandDescription: input.businessDescription, targetAudience: input.targetAudience,
          location: input.location, brandStyle: input.brandStyle, primaryLanguage: "en" });
        // startAiUsage enforces customer billing. Internal work instead reserves its
        // own quota above and records usage here without touching entitlements.
        const [usage] = await tx.insert(aiUsage).values({ userId: PROSPECT_OWNER_ID, projectId,
          module: "website", workflow: "internal-prospect-preview", status: "started", requestCount: 1 }).returning();
        const [record] = await tx.insert(prospectPreviews).values({ idempotencyKey: key, payloadHash,
          status: "processing", projectId, usageId: usage.id, createdAt: now,
          leaseExpiresAt: new Date(now.getTime() + PROSPECT_LEASE_MS) }).returning();
        return { kind: "created", record };
      });
    },
    async finish(record: ProspectRecord, draft: ProspectDraft, tokenHash: string, expiresAt: Date, durationMs: number, components?: readonly AiUsageComponent[]) {
      return database.transaction(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5s'`);
        const [current] = await tx.select().from(prospectPreviews).where(and(eq(prospectPreviews.id, record.id),
          eq(prospectPreviews.status, "processing"), isNull(prospectPreviews.revokedAt),
          gt(prospectPreviews.leaseExpiresAt, sql`now()`))).for("update");
        if (!current) return false;
        const [owned] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, current.projectId), eq(projects.userId, PROSPECT_OWNER_ID)));
        if (!owned) return false;
        const [output] = await tx.insert(projectOutputs).values({ projectId: current.projectId, userId: PROSPECT_OWNER_ID,
          module: "website", result: JSON.stringify(draft), approvedAt: null }).returning({ id: projectOutputs.id });
        await tx.update(aiUsage).set(buildAiUsageCompletionUpdate({ durationMs, usageComponents: components })).where(eq(aiUsage.id, current.usageId));
        await tx.update(prospectPreviews).set({ status: "ready", outputId: output.id, tokenHash, expiresAt, updatedAt: new Date() }).where(eq(prospectPreviews.id, current.id));
        return true;
      });
    },
    async fail(record: ProspectRecord, category: string, durationMs: number) {
      await database.transaction(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5s'`);
        const rows = await tx.update(prospectPreviews).set({ status: "failed", errorCategory: category, updatedAt: new Date() })
          .where(and(eq(prospectPreviews.id, record.id), eq(prospectPreviews.status, "processing"))).returning();
        if (rows.length) await tx.update(aiUsage).set({ status: "failed", durationMs }).where(eq(aiUsage.id, record.usageId));
      });
    },
    async load(token: string) {
      if (!validProspectPreviewToken(token)) return null;
      const [row] = await database.select({ record: prospectPreviews, result: projectOutputs.result }).from(prospectPreviews)
        .innerJoin(projects, and(eq(projects.id, prospectPreviews.projectId), eq(projects.userId, PROSPECT_OWNER_ID)))
        .innerJoin(projectOutputs, and(eq(projectOutputs.id, prospectPreviews.outputId), eq(projectOutputs.projectId, prospectPreviews.projectId),
          eq(projectOutputs.userId, PROSPECT_OWNER_ID), eq(projectOutputs.module, "website")))
        .where(and(eq(prospectPreviews.tokenHash, hashProspectValue(token)), eq(prospectPreviews.status, "ready"),
          isNull(prospectPreviews.revokedAt), gt(prospectPreviews.expiresAt, sql`now()`))).limit(1);
      if (!row || !prospectPreviewAccessible(row.record)) return null;
      try { return validateWebsiteSiteDocument(JSON.parse(row.result).siteDocument); } catch { return null; }
    },
    async revoke(requestId: string) {
      await database.update(prospectPreviews).set({ revokedAt: new Date(), tokenHash: null, updatedAt: new Date() })
        .where(and(eq(prospectPreviews.id, requestId), ne(prospectPreviews.status, "failed")));
    },
  };
}
