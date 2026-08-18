CREATE TABLE "entitlement_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"limit" integer,
	"paid_access_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_overrides_user_category_unique" ON "entitlement_overrides" USING btree ("user_id", "category");
