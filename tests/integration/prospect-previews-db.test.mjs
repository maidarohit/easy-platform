import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createProspectPreviewStore } from "../../app/lib/prospect-preview-store.ts";
import { buildProspectDraft, hashProspectValue, newProspectPreviewToken, validateProspectInput } from "../../app/lib/prospect-preview-core.ts";

test("Postgres: real reservations, quotas, ownership, persistence, expiry and revocation (temporary tables only)", {
  skip: process.env.PROSPECT_PREVIEW_DB_TEST !== "1",
}, async () => {
  const client = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10, idle_timeout: 2 });
  try {
    await drizzle(client).transaction(async tx => {
      // Connection-local shadow tables prevent any writes to real customers,
      // usage, publications or prospect records. Everything is dropped on commit.
      for (const name of ["users", "projects", "ai_usage", "project_outputs"]) {
        await tx.execute(sql.raw(`create temporary table ${name} (like public.${name} including all) on commit drop`));
      }
      const migration = await readFile(new URL("../../drizzle/0035_add_prospect_previews.sql", import.meta.url), "utf8");
      for (const statement of migration.replaceAll("CREATE TABLE IF NOT EXISTS", "CREATE TEMPORARY TABLE")
        .replace(/\n\);/g, "\n) ON COMMIT DROP;").split(";").filter(s => s.trim())) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`insert into users (id,email) values ('customer','customer@example.test')`);
      await tx.execute(sql`insert into projects (id,user_id,name) values ('customer-project','customer','Example Studio')`);
      const store = createProspectPreviewStore(tx);
      const input = validateProspectInput({ companyName: "Example Studio", website: "https://example.test", businessDescription: "Ceramic bowls.", services: ["Pottery"] });
      const hash = hashProspectValue(JSON.stringify(input));
      for (let i = 0; i < 10; i++) assert.equal(await store.rateLimit(), 0);
      assert.ok(await store.rateLimit() > 0);
      await tx.execute(sql`update prospect_preview_rate_limits set window_started_at = now() - interval '61 seconds'`);
      assert.equal(await store.rateLimit(), 0);

      const first = await store.claim("request-first", hash, input);
      assert.equal(first.kind, "created");
      assert.equal((await store.claim("request-first", hash, input)).kind, "existing");
      assert.equal((await store.claim("request-first", "different", input)).kind, "conflict");
      assert.equal((await store.claim("request-second", hash, input)).kind, "created");
      assert.equal((await store.claim("request-third", hash, input)).kind, "limited");
      const generated = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map(key => [key, key === "colourScheme" ? "#123456" : "Ceramic bowls"]));
      const draft = buildProspectDraft(input, generated);
      assert.ok(draft);
      const { token, hash: tokenHash } = newProspectPreviewToken();
      assert.equal(await store.finish(first.record, draft, tokenHash, new Date(Date.now() + 60000), 100), true);
      assert.equal(await store.finish(first.record, draft, tokenHash, new Date(Date.now() + 60000), 100), false);
      assert.ok(await store.load(token));
      const [count] = await tx.execute(sql`select count(*)::int as n from project_outputs`);
      assert.equal(count.n, 1);
      await tx.execute(sql`update prospect_previews set expires_at = now() - interval '1 second' where id = ${first.record.id}::uuid`);
      assert.equal(await store.load(token), null);
      await tx.execute(sql`update prospect_previews set expires_at = now() + interval '1 day' where id = ${first.record.id}::uuid`);
      await store.revoke(first.record.id);
      assert.equal(await store.load(token), null);
      const [customer] = await tx.execute(sql`select id,user_id,name from projects where id = 'customer-project'`);
      assert.deepEqual(customer, { id: "customer-project", user_id: "customer", name: "Example Studio" });
      const [quota] = await tx.execute(sql`select count(*)::int as n from projects`);
      assert.equal(quota.n, 3);

      await tx.execute(sql`update prospect_previews set lease_expires_at = now() - interval '1 second' where status = 'processing'`);
      const interrupted = await store.claim("request-second", hash, input);
      assert.equal(interrupted.record.status, "failed");
      for (let i = 2; i < 25; i++) {
        const claim = await store.claim(`daily-request-${i}`, hash, input);
        assert.equal(claim.kind, "created");
        await store.fail(claim.record, "generation_failed", 1);
        await tx.execute(sql`update prospect_previews set lease_expires_at = now() - interval '1 second' where id = ${claim.record.id}::uuid`);
      }
      const daily = await store.claim("daily-request-26", hash, input);
      assert.equal(daily.kind, "limited");
      assert.equal(daily.retryAfter, 3600);
    });
  } finally { await client.end(); }
});
