import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

const database = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const state = await database.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext('migration:0017:project_preview_customizations'))`;
    const [existing] = await transaction`select to_regclass('public.project_preview_customizations')::text as table_name`;
    if (existing?.table_name) return "already_applied";
    await transaction.unsafe(`CREATE TABLE "project_preview_customizations" (
      "project_id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "approved_at" timestamp with time zone,
      "revision_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "project_preview_customizations_revision_check" CHECK ("revision_count" >= 0),
      CONSTRAINT "project_preview_customizations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
      CONSTRAINT "project_preview_customizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
    )`);
    await transaction.unsafe(`CREATE INDEX "project_preview_customizations_owner_idx" ON "project_preview_customizations" ("user_id")`);
    return "applied";
  });
  console.log(`Preview customization migration: ${state}.`);
} finally {
  await database.end();
}
