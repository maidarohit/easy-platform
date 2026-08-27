import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
const sqlText = await readFile(new URL("../drizzle/0021_add-public-contact-and-inquiries.sql", import.meta.url), "utf8");
const database = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await database.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('migration:0021:public-contact-inquiries'))`;
    await transaction.unsafe(sqlText);
  });
  console.log("Public contact migration applied safely.");
} finally { await database.end(); }
