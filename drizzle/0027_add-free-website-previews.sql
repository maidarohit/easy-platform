CREATE TABLE IF NOT EXISTS "free_website_previews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "claim_token" uuid NOT NULL,
  "status" varchar(16) NOT NULL,
  "lease_expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "free_website_previews_status_check" CHECK ("status" in ('claimed','used'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "free_website_previews_user_unique" ON "free_website_previews" ("user_id");
