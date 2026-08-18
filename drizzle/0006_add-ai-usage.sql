CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"module" text NOT NULL,
	"workflow" text,
	"model" text,
	"request_count" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
