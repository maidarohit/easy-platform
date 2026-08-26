CREATE TABLE "business_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"public_slug" varchar(63) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"published_preview_revision" integer NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"unpublished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_publications_status_check" CHECK ("status" in ('active','inactive')),
	CONSTRAINT "business_publications_revision_check" CHECK ("published_preview_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "business_publication_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"preview_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_publications" ADD CONSTRAINT "business_publications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "business_publications" ADD CONSTRAINT "business_publications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "business_publication_versions" ADD CONSTRAINT "business_publication_versions_publication_id_business_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."business_publications"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "business_publications_project_unique" ON "business_publications" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "business_publications_slug_unique" ON "business_publications" USING btree ("public_slug");
--> statement-breakpoint
CREATE INDEX "business_publications_owner_idx" ON "business_publications" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "business_publication_versions_publication_version_unique" ON "business_publication_versions" USING btree ("publication_id","version_number");
--> statement-breakpoint
CREATE INDEX "business_publication_versions_publication_idx" ON "business_publication_versions" USING btree ("publication_id");
