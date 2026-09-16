CREATE TABLE IF NOT EXISTS "platform_page_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "pathname" varchar(1024) NOT NULL,
  "referrer" varchar(255),
  "utm_source" varchar(200),
  "utm_medium" varchar(200),
  "utm_campaign" varchar(200),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "platform_page_views_time_session_idx" ON "platform_page_views" ("created_at", "session_id");
CREATE INDEX IF NOT EXISTS "platform_page_views_session_time_idx" ON "platform_page_views" ("session_id", "created_at");
