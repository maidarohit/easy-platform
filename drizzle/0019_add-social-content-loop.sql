CREATE TABLE "social_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" varchar(16) NOT NULL,
  "provider_account_id" varchar(255),
  "account_name" varchar(255),
  "status" varchar(24) DEFAULT 'setup_required' NOT NULL,
  "connected_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_connections_provider_check" CHECK ("provider" IN ('meta','linkedin')),
  CONSTRAINT "social_connections_status_check" CHECK ("status" IN ('setup_required','connected','needs_attention'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_connections_project_provider_unique" ON "social_connections" ("project_id", "provider");
--> statement-breakpoint
CREATE INDEX "social_connections_owner_idx" ON "social_connections" ("user_id");
--> statement-breakpoint

CREATE TABLE "social_daily_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "local_date" varchar(10) NOT NULL,
  "source_hash" varchar(64) NOT NULL,
  "original_content" text NOT NULL,
  "edited_content" text,
  "platform" varchar(24) DEFAULT 'general' NOT NULL,
  "theme" varchar(160),
  "recommended_action" varchar(255),
  "status" varchar(16) DEFAULT 'proposed' NOT NULL,
  "provider" varchar(16),
  "provider_account_id" varchar(255),
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_daily_posts_date_check" CHECK ("local_date" ~ '^\\d{4}-\\d{2}-\\d{2}$'),
  CONSTRAINT "social_daily_posts_status_check" CHECK ("status" IN ('proposed','approved','skipped','published','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_daily_posts_project_date_unique" ON "social_daily_posts" ("project_id", "local_date");
--> statement-breakpoint
CREATE INDEX "social_daily_posts_owner_idx" ON "social_daily_posts" ("user_id");
