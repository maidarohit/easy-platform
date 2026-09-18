import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
const database = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const migration = await readFile(new URL("../drizzle/0034_add_website_page_views.sql", import.meta.url), "utf8");
  await database.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('migration:0034:website_page_views'))`;
    await tx.unsafe(migration);
  });
  console.log("Customer website traffic migration 0034 applied.");
} finally { await database.end(); }
