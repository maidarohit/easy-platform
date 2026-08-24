CREATE TABLE "easy_mode_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"goal_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	CONSTRAINT "easy_mode_runs_goal_id_check" CHECK ("easy_mode_runs"."goal_id" in ('build_everything','build_website','get_customers','build_brand','create_content','improve_business')),
	CONSTRAINT "easy_mode_runs_status_check" CHECK ("easy_mode_runs"."status" in ('queued','running','partially_completed','completed','failed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "easy_mode_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"module_id" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"safe_error_code" varchar(64),
	"project_output_id" uuid,
	CONSTRAINT "easy_mode_tasks_module_id_check" CHECK ("easy_mode_tasks"."module_id" in ('ai-manager','analytics','branding','branding-context','content','image','logo','marketing','sales','seo','uiux','website')),
	CONSTRAINT "easy_mode_tasks_status_check" CHECK ("easy_mode_tasks"."status" in ('queued','running','completed','failed','skipped')),
	CONSTRAINT "easy_mode_tasks_position_check" CHECK ("easy_mode_tasks"."position" >= 0),
	CONSTRAINT "easy_mode_tasks_attempt_count_check" CHECK ("easy_mode_tasks"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "easy_mode_runs" ADD CONSTRAINT "easy_mode_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_runs" ADD CONSTRAINT "easy_mode_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_tasks" ADD CONSTRAINT "easy_mode_tasks_run_id_easy_mode_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."easy_mode_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "easy_mode_tasks" ADD CONSTRAINT "easy_mode_tasks_project_output_id_project_outputs_id_fk" FOREIGN KEY ("project_output_id") REFERENCES "public"."project_outputs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_runs_owner_project_idempotency_unique" ON "easy_mode_runs" USING btree ("user_id","project_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "easy_mode_runs_owner_project_idx" ON "easy_mode_runs" USING btree ("user_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "easy_mode_tasks_run_position_unique" ON "easy_mode_tasks" USING btree ("run_id","position");
--> statement-breakpoint
CREATE INDEX "easy_mode_tasks_run_idx" ON "easy_mode_tasks" USING btree ("run_id");
