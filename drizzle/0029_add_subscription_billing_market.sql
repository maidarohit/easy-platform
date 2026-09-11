ALTER TABLE "subscriptions"
  ADD COLUMN "provider_plan_id" text;
--> statement-breakpoint
ALTER TABLE "subscriptions"
  ADD COLUMN "billing_market" varchar(16);
--> statement-breakpoint
ALTER TABLE "subscriptions"
  ADD COLUMN "billing_currency" varchar(3);
--> statement-breakpoint
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_market_check"
  CHECK ("billing_market" in ('india','international') or "billing_market" is null);
--> statement-breakpoint
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_currency_check"
  CHECK ("billing_currency" in ('INR','USD') or "billing_currency" is null);
