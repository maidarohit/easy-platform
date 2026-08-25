CREATE TABLE "project_business_dna" (
	"project_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dna" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_business_dna_schema_version_check" CHECK ("project_business_dna"."schema_version" = 1),
	CONSTRAINT "project_business_dna_revision_count_check" CHECK ("project_business_dna"."revision_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_business_dna" ADD CONSTRAINT "project_business_dna_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_business_dna" ADD CONSTRAINT "project_business_dna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "project_business_dna_owner_idx" ON "project_business_dna" USING btree ("user_id");
