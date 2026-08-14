ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "location" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "business_stage" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "original_brief" text;
