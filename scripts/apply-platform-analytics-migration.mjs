import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
const database = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const migration = await readFile(new URL("../drizzle/0032_add_platform_page_views.sql", import.meta.url), "utf8");
  const visitors = await readFile(new URL("../drizzle/0033_add_platform_visitor_id.sql", import.meta.url), "utf8");
  await database.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('migration:0032:platform_page_views'))`;
    await transaction.unsafe(migration);
    await transaction.unsafe(visitors);
  });
  console.log("Platform analytics migration applied.");
} finally {
  await database.end();
}
