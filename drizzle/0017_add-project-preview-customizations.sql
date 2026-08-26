CREATE TABLE "project_preview_customizations" (
	"project_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approved_at" timestamp with time zone,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_preview_customizations_revision_check" CHECK ("project_preview_customizations"."revision_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_preview_customizations" ADD CONSTRAINT "project_preview_customizations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_preview_customizations" ADD CONSTRAINT "project_preview_customizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_preview_customizations_owner_idx" ON "project_preview_customizations" USING btree ("user_id");
