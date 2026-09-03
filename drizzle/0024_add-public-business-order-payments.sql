CREATE TABLE IF NOT EXISTS "public_business_order_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL
    REFERENCES "public_business_orders"("id") ON DELETE RESTRICT,
  "project_id" text NOT NULL
    REFERENCES "projects"("id") ON DELETE RESTRICT,
  "merchant_account_id" uuid NOT NULL
    REFERENCES "project_merchant_payment_accounts"("id") ON DELETE RESTRICT,
  "provider" varchar(32) NOT NULL DEFAULT 'razorpay'
    CHECK ("provider" IN ('razorpay')),
  "provider_order_id" varchar(64),
  "provider_payment_id" varchar(64),
  "provider_account_id" varchar(64) NOT NULL,
  "provider_receipt" varchar(40) NOT NULL,
  "amount_paise" integer NOT NULL
    CHECK ("amount_paise" > 0),
  "currency" varchar(3) NOT NULL DEFAULT 'INR'
    CHECK ("currency" = 'INR'),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_business_order_payments_order_uidx"
  ON "public_business_order_payments" ("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "public_business_order_payments_receipt_uidx"
  ON "public_business_order_payments" ("provider_receipt");

CREATE UNIQUE INDEX IF NOT EXISTS "public_business_order_payments_provider_order_uidx"
  ON "public_business_order_payments" ("provider", "provider_order_id")
  WHERE "provider_order_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "public_business_order_payments_provider_payment_uidx"
  ON "public_business_order_payments" ("provider", "provider_payment_id")
  WHERE "provider_payment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "public_business_order_payments_project_idx"
  ON "public_business_order_payments" ("project_id");


CREATE TABLE IF NOT EXISTS "public_business_payment_events" (
  "provider_event_id" varchar(200) PRIMARY KEY,
  "event_type" varchar(100) NOT NULL,
  "provider_order_id" varchar(64),
  "provider_payment_id" varchar(64),
  "order_id" uuid
    REFERENCES "public_business_orders"("id") ON DELETE RESTRICT,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "outcome" varchar(32)
);

CREATE INDEX IF NOT EXISTS "public_business_payment_events_provider_order_idx"
  ON "public_business_payment_events" ("provider_order_id");

CREATE INDEX IF NOT EXISTS "public_business_payment_events_order_idx"
  ON "public_business_payment_events" ("order_id");
