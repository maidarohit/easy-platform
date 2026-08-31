CREATE TABLE IF NOT EXISTS "project_commerce_settings" (
  "project_id" text PRIMARY KEY REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "currency" varchar(3) NOT NULL DEFAULT 'INR',
  "checkout_mode" varchar(32) NOT NULL DEFAULT 'order_request',
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_commerce_settings_owner_idx"
  ON "project_commerce_settings" ("user_id");


CREATE TABLE IF NOT EXISTS "project_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(160) NOT NULL,
  "slug" varchar(180),
  "description" text,
  "category" varchar(120),
  "kind" varchar(20) NOT NULL DEFAULT 'product'
    CHECK ("kind" IN ('product', 'service')),
  "price_paise" integer NOT NULL
    CHECK ("price_paise" >= 0),
  "currency" varchar(3) NOT NULL DEFAULT 'INR',
  "image_url" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_products_project_idx"
  ON "project_products" ("project_id");

CREATE INDEX IF NOT EXISTS "project_products_owner_idx"
  ON "project_products" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "project_products_project_slug_uidx"
  ON "project_products" ("project_id", "slug")
  WHERE "slug" IS NOT NULL;


CREATE TABLE IF NOT EXISTS "public_business_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
  "publication_id" uuid REFERENCES "business_publications"("id") ON DELETE RESTRICT,
  "customer_name" varchar(160) NOT NULL,
  "customer_email" varchar(254),
  "customer_phone" varchar(32),
  "delivery_address" jsonb,
  "currency" varchar(3) NOT NULL DEFAULT 'INR',
  "subtotal_paise" integer NOT NULL
    CHECK ("subtotal_paise" >= 0),
  "total_paise" integer NOT NULL
    CHECK ("total_paise" >= 0),
  "status" varchar(24) NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
  "payment_status" varchar(24) NOT NULL DEFAULT 'unpaid'
    CHECK ("payment_status" IN ('unpaid', 'pending', 'paid', 'refunded')),
  "customer_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "public_business_orders_project_idx"
  ON "public_business_orders" ("project_id");

CREATE INDEX IF NOT EXISTS "public_business_orders_publication_idx"
  ON "public_business_orders" ("publication_id");

CREATE INDEX IF NOT EXISTS "public_business_orders_created_idx"
  ON "public_business_orders" ("created_at");


CREATE TABLE IF NOT EXISTS "public_business_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES "public_business_orders"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "project_products"("id") ON DELETE SET NULL,
  "product_name" varchar(160) NOT NULL,
  "unit_price_paise" integer NOT NULL
    CHECK ("unit_price_paise" >= 0),
  "quantity" integer NOT NULL DEFAULT 1
    CHECK ("quantity" > 0),
  "line_total_paise" integer NOT NULL
    CHECK ("line_total_paise" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "public_business_order_items_order_idx"
  ON "public_business_order_items" ("order_id");