CREATE TABLE "published_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_uid" text NOT NULL,
	"project_id" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"template" varchar(32) NOT NULL,
	"current_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_published_at" timestamp with time zone NOT NULL,
	"last_published_at" timestamp with time zone NOT NULL,
	"unpublished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "website_publication_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"published_website_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_publication_versions" ADD CONSTRAINT "website_publication_versions_published_website_id_published_websites_id_fk" FOREIGN KEY ("published_website_id") REFERENCES "public"."published_websites"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "published_websites_slug_unique" ON "published_websites" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "published_websites_project_unique" ON "published_websites" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "published_websites_owner_uid_idx" ON "published_websites" USING btree ("owner_uid");
--> statement-breakpoint
CREATE UNIQUE INDEX "website_publication_versions_site_version_unique" ON "website_publication_versions" USING btree ("published_website_id","version_number");
--> statement-breakpoint
CREATE INDEX "website_publication_versions_site_idx" ON "website_publication_versions" USING btree ("published_website_id");
