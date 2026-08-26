CREATE TABLE IF NOT EXISTS "weekly_report_preferences" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "whatsapp_opt_in_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "weekly_report_preferences_owner_idx" ON "weekly_report_preferences" ("user_id");

CREATE TABLE IF NOT EXISTS "weekly_report_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start" varchar(10) NOT NULL,
  "channel" varchar(16) NOT NULL CHECK ("channel" IN ('email','whatsapp')),
  "status" varchar(16) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','delivered','failed')),
  "attempted_at" timestamptz,
  "delivered_at" timestamptz,
  "failure_code" varchar(64),
  "provider_message_id" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "weekly_report_deliveries_project_week_channel_unique" UNIQUE ("project_id", "week_start", "channel")
);
CREATE INDEX IF NOT EXISTS "weekly_report_deliveries_owner_idx" ON "weekly_report_deliveries" ("user_id");
