CREATE TABLE "ai_usage_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_id" uuid NOT NULL,
	"n8n_execution_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_reconciliations" ADD CONSTRAINT "ai_usage_reconciliations_usage_id_ai_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_reconciliations_usage_id_unique" ON "ai_usage_reconciliations" USING btree ("usage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_reconciliations_execution_id_unique" ON "ai_usage_reconciliations" USING btree ("n8n_execution_id");
