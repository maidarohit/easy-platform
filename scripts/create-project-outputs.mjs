import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const sql = postgres(connectionString, { max: 1 });

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "project_outputs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" text NOT NULL,
      "user_id" text NOT NULL,
      "module" text NOT NULL,
      "result" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  console.log("✅ project_outputs table created successfully");
} finally {
  await sql.end();
}