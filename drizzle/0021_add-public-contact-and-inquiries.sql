CREATE TABLE IF NOT EXISTS "project_public_contacts" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "revision_count" integer NOT NULL DEFAULT 0 CHECK ("revision_count" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "project_public_contacts_owner_idx" ON "project_public_contacts" ("user_id");

CREATE TABLE IF NOT EXISTS "public_business_inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication_id" uuid NOT NULL REFERENCES "business_publications"("id") ON DELETE RESTRICT,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
  "name" varchar(120) NOT NULL,
  "email" varchar(254) NOT NULL,
  "phone" varchar(32),
  "service" varchar(160),
  "message" text NOT NULL,
  "source_ip_hash" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "public_business_inquiries_publication_idx" ON "public_business_inquiries" ("publication_id", "created_at");
CREATE INDEX IF NOT EXISTS "public_business_inquiries_rate_idx" ON "public_business_inquiries" ("publication_id", "source_ip_hash", "created_at");
