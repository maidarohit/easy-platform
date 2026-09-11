CREATE TABLE "usage_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "category" text NOT NULL,
  "threshold_percent" integer NOT NULL,
  "billing_period_start" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "usage_notifications_threshold_check" CHECK ("threshold_percent" in (50, 80, 100))
);
--> statement-breakpoint
ALTER TABLE "usage_notifications"
  ADD CONSTRAINT "usage_notifications_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "usage_notifications_user_category_threshold_period_unique"
  ON "usage_notifications" USING btree ("user_id","category","threshold_percent","billing_period_start");
--> statement-breakpoint
CREATE INDEX "usage_notifications_owner_period_idx"
  ON "usage_notifications" USING btree ("user_id","billing_period_start","created_at");
