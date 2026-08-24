CREATE TABLE "easy_mode_task_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"execution_key" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'claimed' NOT NULL,
	"usage_id" uuid,
	"provider_execution_id" varchar(200),
	"lease_token" uuid NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"safe_error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "easy_mode_task_attempts_status_check" CHECK ("easy_mode_task_attempts"."status" in ('claimed','dispatching','running','completed','failed_before_dispatch','failed_uncertain')),
	CONSTRAINT "easy_mode_task_attempts_attempt_number_check" CHECK ("easy_mode_task_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "easy_mode_task_attempts" ADD CONSTRAINT "easy_mode_task_attempts_task_id_easy_mode_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."easy_mode_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_task_attempts" ADD CONSTRAINT "easy_mode_task_attempts_run_id_easy_mode_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."easy_mode_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_task_attempts" ADD CONSTRAINT "easy_mode_task_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_task_attempts" ADD CONSTRAINT "easy_mode_task_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_task_attempts" ADD CONSTRAINT "easy_mode_task_attempts_usage_id_ai_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_task_attempts_task_number_unique" ON "easy_mode_task_attempts" USING btree ("task_id","attempt_number");
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_task_attempts_execution_key_unique" ON "easy_mode_task_attempts" USING btree ("execution_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_task_attempts_usage_id_unique" ON "easy_mode_task_attempts" USING btree ("usage_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_task_attempts_one_active_per_run_unique" ON "easy_mode_task_attempts" USING btree ("run_id") WHERE "easy_mode_task_attempts"."status" in ('claimed','dispatching','running');
--> statement-breakpoint
CREATE INDEX "easy_mode_task_attempts_run_idx" ON "easy_mode_task_attempts" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "easy_mode_task_attempts_task_idx" ON "easy_mode_task_attempts" USING btree ("task_id");
