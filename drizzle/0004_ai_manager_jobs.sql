CREATE TABLE IF NOT EXISTS "ai_manager_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_manager_jobs_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed'))
);
