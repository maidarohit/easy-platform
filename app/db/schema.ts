import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  companyName: text("company_name"),
  industry: text("industry"),
  targetAudience: text("target_audience"),
  goal: text("goal"),
  location: text("location"),
  businessStage: text("business_stage"),
  originalBrief: text("original_brief"),
  brandStyle: text("brand_style"),
  brandDescription: text("brand_description"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: text("user_id").notNull(),

  projectId: text("project_id"),

  module: text("module").notNull(),

  workflow: text("workflow"),

  model: text("model"),

  requestCount: integer("request_count").default(1).notNull(),

  inputTokens: integer("input_tokens"),

  outputTokens: integer("output_tokens"),

  estimatedCostUsd: numeric("estimated_cost_usd", {
    precision: 12,
    scale: 6,
  })
    .default("0")
    .notNull(),

  durationMs: integer("duration_ms"),

  status: text("status").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectMemory = pgTable("project_memory", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),

  businessName: text("business_name"),
  industry: text("industry"),
  businessDescription: text("business_description"),
  targetAudience: text("target_audience"),
  brandStyle: text("brand_style"),
  brandVoice: text("brand_voice"),
  brandColors: text("brand_colors"),
  typography: text("typography"),
  websiteGoal: text("website_goal"),
  marketingGoal: text("marketing_goal"),
  additionalContext: text("additional_context"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AiManagerJobStatus = "pending" | "processing" | "completed" | "failed";

export const aiManagerJobs = pgTable("ai_manager_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  usageId: uuid("usage_id").references(() => aiUsage.id).unique(),
  status: text("status").$type<AiManagerJobStatus>().notNull().default("pending"),
  result: text("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const projectOutputs = pgTable("project_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),

  module: text("module").notNull(),
  result: text("result").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const publicAiUsage = pgTable("public_ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),

  visitorId: text("visitor_id").notNull(),

  ipHash: text("ip_hash"),

  module: text("module").notNull(),

  workflow: text("workflow").notNull(),

  model: text("model"),

  requestCount: integer("request_count").default(1).notNull(),

  inputTokens: integer("input_tokens"),

  outputTokens: integer("output_tokens"),

  estimatedCostUsd: numeric("estimated_cost_usd", {
    precision: 12,
    scale: 6,
  })
    .default("0")
    .notNull(),

  durationMs: integer("duration_ms"),

  status: text("status").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SubscriptionPlan = "pro" | "business";
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").$type<SubscriptionPlan>().notNull(),
    provider: text("provider").notNull().default("razorpay"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    status: text("status").$type<SubscriptionStatus>().notNull().default("pending"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("subscriptions_provider_subscription_id_unique").on(
      table.providerSubscriptionId
    ),
    index("subscriptions_user_id_idx").on(table.userId),
  ]
);

export type RazorpayWebhookEventOutcome =
  | "processed"
  | "ignored_stale"
  | "ignored_terminal"
  | "ignored_unsupported";

export const razorpayWebhookEvents = pgTable(
  "razorpay_webhook_events",
  {
    providerEventId: varchar("provider_event_id", { length: 200 }).primaryKey(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 200 }).notNull(),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    outcome: varchar("outcome", { length: 32 }).$type<RazorpayWebhookEventOutcome>(),
  },
  (table) => [
    index("razorpay_webhook_events_subscription_created_idx").on(
      table.providerSubscriptionId,
      table.providerCreatedAt,
    ),
  ],
);

export const entitlementOverrides = pgTable(
  "entitlement_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    limit: integer("limit"),
    paidAccessDisabled: boolean("paid_access_disabled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("entitlement_overrides_user_category_unique").on(
      table.userId,
      table.category
    ),
  ]
);

export type AiUsageReconciliationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "exhausted";

export const aiUsageReconciliations = pgTable(
  "ai_usage_reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usageId: uuid("usage_id")
      .notNull()
      .references(() => aiUsage.id, { onDelete: "cascade" }),
    n8nExecutionId: text("n8n_execution_id").notNull(),
    status: text("status")
      .$type<AiUsageReconciliationStatus>()
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ai_usage_reconciliations_usage_id_unique").on(table.usageId),
    uniqueIndex("ai_usage_reconciliations_execution_id_unique").on(
      table.n8nExecutionId
    ),
  ]
);
