import "server-only";
import { validateProspectRenderMetadata } from "./prospect-site-composer";

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
      let requestId: string | undefined;
      let stage = "token_received";
      const diagnostic = (success: boolean, category?: string) => {
        // Only fixed categories and the database request UUID may reach logs.
        // Never pass a token, hash, SQL error, exception message or draft here.
        const event = { ...(requestId && { requestId }), stage, success, ...(category && { category }) };
        if (success) console.info("Prospect preview load.", event);
        else console.warn("Prospect preview load.", event);
      };
      try {
        if (!validProspectPreviewToken(token)) {
          diagnostic(false, "invalid_token_format");
          return null;
        }
        diagnostic(true);
        stage = "token_hash_calculated";
        const tokenHash = hashProspectValue(token);
        diagnostic(true);
        stage = "preview_row_lookup";
        // Keep one database snapshot. Left joins expose which relation failed;
        // the original ownership, module and access restrictions still gate return.
        const [row] = await database.select({
          record: prospectPreviews,
          project: { id: projects.id },
          output: { id: projectOutputs.id, result: projectOutputs.result },
          databaseAccessible: sql<boolean>`${prospectPreviews.status} = 'ready' and ${prospectPreviews.revokedAt} is null and ${prospectPreviews.expiresAt} > now()`,
        }).from(prospectPreviews)
          .leftJoin(projects, and(eq(projects.id, prospectPreviews.projectId), eq(projects.userId, PROSPECT_OWNER_ID)))
          .leftJoin(projectOutputs, and(eq(projectOutputs.id, prospectPreviews.outputId), eq(projectOutputs.projectId, prospectPreviews.projectId),
            eq(projectOutputs.userId, PROSPECT_OWNER_ID), eq(projectOutputs.module, "website")))
          .where(eq(prospectPreviews.tokenHash, tokenHash)).limit(1);
        if (!row) {
          diagnostic(false, "not_found");
          return null;
        }
        requestId = row.record.id;
        diagnostic(true);
        stage = "expiry_revocation_check";
        if (!row.databaseAccessible || !prospectPreviewAccessible(row.record)) {
          diagnostic(false, row.record.status !== "ready" ? "not_ready" : row.record.revokedAt ? "revoked" : "expired_or_invalid_expiry");
          return null;
        }
        diagnostic(true);
        stage = "project_lookup";
        if (!row.project) {
          diagnostic(false, "missing_or_unauthorized_project");
          return null;
        }
        diagnostic(true);
        stage = "project_output_lookup";
        if (!row.output) {
          diagnostic(false, "missing_or_unauthorized_output");
          return null;
        }
        diagnostic(true);
        stage = "draft_parse_validation";
        const snapshot = JSON.parse(row.output.result);
        const document = validateWebsiteSiteDocument(snapshot.siteDocument);
        const render = snapshot.prospectRender === undefined ? null : validateProspectRenderMetadata(snapshot.prospectRender);
        if (snapshot.prospectRender !== undefined && !render) {
          diagnostic(false, "invalid_render_metadata");
          return null;
        }
        if (!document) {
          diagnostic(false, "invalid_site_document");
          return null;
        }
        diagnostic(true);
        stage = "renderer_data_ready";
        diagnostic(true);
        return { document, render };
      } catch {
        diagnostic(false, stage === "preview_row_lookup" ? "database_lookup_error" : stage === "draft_parse_validation" ? "draft_parse_or_validation_error" : "loader_error");
        return null;
      }
    },
    async revoke(requestId: string) {
      await database.update(prospectPreviews).set({ revokedAt: new Date(), tokenHash: null, updatedAt: new Date() })
        .where(and(eq(prospectPreviews.id, requestId), ne(prospectPreviews.status, "failed")));
    },
  };
}
