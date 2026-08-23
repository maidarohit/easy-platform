CREATE TABLE "razorpay_webhook_events" (
	"provider_event_id" varchar(200) PRIMARY KEY NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"provider_subscription_id" varchar(200) NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" varchar(32)
);
--> statement-breakpoint
CREATE INDEX "razorpay_webhook_events_subscription_created_idx" ON "razorpay_webhook_events" USING btree ("provider_subscription_id", "provider_created_at");
