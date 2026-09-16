-- Legacy rows cannot be attributed to a persistent visitor. Keep them NULL.
ALTER TABLE "platform_page_views" ADD COLUMN IF NOT EXISTS "visitor_id" uuid;
CREATE INDEX IF NOT EXISTS "platform_page_views_time_visitor_idx" ON "platform_page_views" ("created_at", "visitor_id");
