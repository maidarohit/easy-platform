CREATE TABLE IF NOT EXISTS "project_merchant_payment_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL DEFAULT 'razorpay'
    CHECK ("provider" IN ('razorpay')),
  "provider_account_id" varchar(64),
  "status" varchar(32) NOT NULL DEFAULT 'not_started'
    CHECK ("status" IN (
      'not_started',
      'setup_in_progress',
      'under_review',
      'active',
      'needs_action',
      'unavailable'
    )),
  "onboarding_status" varchar(40) NOT NULL DEFAULT 'not_started'
    CHECK ("onboarding_status" IN (
      'not_started',
      'account_created',
      'stakeholder_created',
      'product_requested',
      'settlements_submitted',
      'needs_clarification',
      'under_review',
      'activated',
      'unavailable',
      'failed'
    )),
  "product_configuration_id" varchar(64),
  "stakeholder_id" varchar(64),
  "last_error_code" varchar(64),
  "last_error_message" varchar(280),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_merchant_payment_accounts_project_provider_uidx"
  ON "project_merchant_payment_accounts" ("project_id", "provider");

CREATE INDEX IF NOT EXISTS "project_merchant_payment_accounts_owner_idx"
  ON "project_merchant_payment_accounts" ("user_id");
