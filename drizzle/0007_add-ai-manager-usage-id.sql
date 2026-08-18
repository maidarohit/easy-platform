ALTER TABLE "ai_manager_jobs" ADD COLUMN "usage_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_manager_jobs" ADD CONSTRAINT "ai_manager_jobs_usage_id_ai_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_manager_jobs" ADD CONSTRAINT "ai_manager_jobs_usage_id_unique" UNIQUE("usage_id");