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
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { BusinessDnaContent } from "@/app/lib/business-dna";
import type { PreviewOverrides } from "@/app/lib/business-preview-edits";
import type { PublishedBusinessSnapshot } from "@/app/lib/business-publication";
import type { PublicContactSettings } from "@/app/lib/public-contact";

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
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SocialProvider = "meta" | "linkedin";
export type SocialConnectionStatus = "setup_required" | "connected" | "needs_attention";
export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 16 }).$type<SocialProvider>().notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }),
    accountName: varchar("account_name", { length: 255 }),
    status: varchar("status", { length: 24 }).$type<SocialConnectionStatus>().notNull().default("setup_required"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("social_connections_project_provider_unique").on(table.projectId, table.provider),
    index("social_connections_owner_idx").on(table.userId),
  ],
);

export type SocialDailyPostStatus = "proposed" | "approved" | "skipped" | "published" | "failed";
export const socialDailyPosts = pgTable(
  "social_daily_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    localDate: varchar("local_date", { length: 10 }).notNull(),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    originalContent: text("original_content").notNull(),
    editedContent: text("edited_content"),
    platform: varchar("platform", { length: 24 }).notNull().default("general"),
    theme: varchar("theme", { length: 160 }),
    recommendedAction: varchar("recommended_action", { length: 255 }),
    status: varchar("status", { length: 16 }).$type<SocialDailyPostStatus>().notNull().default("proposed"),
    provider: varchar("provider", { length: 16 }).$type<SocialProvider>(),
    providerAccountId: varchar("provider_account_id", { length: 255 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("social_daily_posts_project_date_unique").on(table.projectId, table.localDate),
    index("social_daily_posts_owner_idx").on(table.userId),
    check("social_daily_posts_date_check", sql`${table.localDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
  ],
);

export type WeeklyReportDeliveryChannel = "email" | "whatsapp";
export type WeeklyReportDeliveryStatus = "pending" | "delivered" | "failed";
export const weeklyReportPreferences = pgTable("weekly_report_preferences", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  whatsappOptInAt: timestamp("whatsapp_opt_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("weekly_report_preferences_owner_idx").on(table.userId)]);

export const weeklyReportDeliveries = pgTable("weekly_report_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: varchar("week_start", { length: 10 }).notNull(),
  channel: varchar("channel", { length: 16 }).$type<WeeklyReportDeliveryChannel>().notNull(),
  status: varchar("status", { length: 16 }).$type<WeeklyReportDeliveryStatus>().notNull().default("pending"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failureCode: varchar("failure_code", { length: 64 }),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("weekly_report_deliveries_project_week_channel_unique").on(table.projectId, table.weekStart, table.channel),
  index("weekly_report_deliveries_owner_idx").on(table.userId),
  check("weekly_report_deliveries_channel_check", sql`${table.channel} in ('email','whatsapp')`),
  check("weekly_report_deliveries_status_check", sql`${table.status} in ('pending','delivered','failed')`),
]);

export const projectBusinessDna = pgTable(
  "project_business_dna",
  {
    projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dna: jsonb("dna").$type<BusinessDnaContent>().notNull().default({}),
    schemaVersion: integer("schema_version").notNull().default(1),
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    revisionCount: integer("revision_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_business_dna_owner_idx").on(table.userId),
    check("project_business_dna_schema_version_check", sql`${table.schemaVersion} = 1`),
    check("project_business_dna_revision_count_check", sql`${table.revisionCount} >= 0`),
  ],
);

export const projectPreviewCustomizations = pgTable(
  "project_preview_customizations",
  {
    projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    overrides: jsonb("overrides").$type<PreviewOverrides>().notNull().default({}),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revisionCount: integer("revision_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_preview_customizations_owner_idx").on(table.userId),
    check("project_preview_customizations_revision_check", sql`${table.revisionCount} >= 0`),
  ],
);

export const projectPublicContacts = pgTable("project_public_contacts", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<PublicContactSettings>().notNull().default({}),
  revisionCount: integer("revision_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("project_public_contacts_owner_idx").on(table.userId)]);

export type BusinessPublicationStatus = "active" | "inactive";
export const businessPublications = pgTable(
  "business_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    publicSlug: varchar("public_slug", { length: 63 }).notNull(),
    status: varchar("status", { length: 16 }).$type<BusinessPublicationStatus>().notNull().default("active"),
    publishedPreviewRevision: integer("published_preview_revision").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("business_publications_project_unique").on(table.projectId),
    uniqueIndex("business_publications_slug_unique").on(table.publicSlug),
    index("business_publications_owner_idx").on(table.userId),
    check("business_publications_status_check", sql`${table.status} in ('active','inactive')`),
    check("business_publications_revision_check", sql`${table.publishedPreviewRevision} >= 0`),
  ],
);

export const businessPublicationVersions = pgTable(
  "business_publication_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicationId: uuid("publication_id").notNull().references(() => businessPublications.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    previewRevision: integer("preview_revision").notNull(),
    snapshot: jsonb("snapshot").$type<PublishedBusinessSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("business_publication_versions_publication_version_unique").on(table.publicationId, table.versionNumber),
    index("business_publication_versions_publication_idx").on(table.publicationId),
  ],
);

export const publicBusinessInquiries = pgTable("public_business_inquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicationId: uuid("publication_id").notNull().references(() => businessPublications.id, { onDelete: "restrict" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  service: varchar("service", { length: 160 }),
  message: text("message").notNull(),
  sourceIpHash: varchar("source_ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("public_business_inquiries_publication_idx").on(table.publicationId, table.createdAt),
  index("public_business_inquiries_rate_idx").on(table.publicationId, table.sourceIpHash, table.createdAt),
]);

export type EasyModeRunStatus = "queued" | "running" | "partially_completed" | "completed" | "failed" | "cancelled";
export type EasyModeTaskStatus = "queued" | "running" | "completed" | "failed" | "skipped";
export type EasyModeTaskAttemptStatus =
  | "claimed"
  | "dispatching"
  | "running"
  | "completed"
  | "failed_before_dispatch"
  | "failed_uncertain";

export const easyModeRuns = pgTable(
  "easy_mode_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    goalId: varchar("goal_id", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).$type<EasyModeRunStatus>().notNull().default("queued"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("easy_mode_runs_owner_project_idempotency_unique").on(table.userId, table.projectId, table.idempotencyKey),
    index("easy_mode_runs_owner_project_idx").on(table.userId, table.projectId),
    check("easy_mode_runs_goal_id_check", sql`${table.goalId} in ('build_everything','build_website','get_customers','build_brand','create_content','improve_business')`),
    check("easy_mode_runs_status_check", sql`${table.status} in ('queued','running','partially_completed','completed','failed','cancelled')`),
  ],
);

export const easyModeTasks = pgTable(
  "easy_mode_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull().references(() => easyModeRuns.id, { onDelete: "cascade" }),
    moduleId: varchar("module_id", { length: 64 }).notNull(),
    position: integer("position").notNull(),
    status: varchar("status", { length: 16 }).$type<EasyModeTaskStatus>().notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    safeErrorCode: varchar("safe_error_code", { length: 64 }),
    projectOutputId: uuid("project_output_id").references(() => projectOutputs.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("easy_mode_tasks_run_position_unique").on(table.runId, table.position),
    index("easy_mode_tasks_run_idx").on(table.runId),
    check("easy_mode_tasks_module_id_check", sql`${table.moduleId} in ('ai-manager','analytics','branding','branding-context','content','image','logo','marketing','sales','seo','uiux','website')`),
    check("easy_mode_tasks_status_check", sql`${table.status} in ('queued','running','completed','failed','skipped')`),
    check("easy_mode_tasks_position_check", sql`${table.position} >= 0`),
    check("easy_mode_tasks_attempt_count_check", sql`${table.attemptCount} >= 0`),
  ],
);

export const easyModeTaskAttempts = pgTable(
  "easy_mode_task_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull().references(() => easyModeTasks.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull().references(() => easyModeRuns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    executionKey: varchar("execution_key", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).$type<EasyModeTaskAttemptStatus>().notNull().default("claimed"),
    usageId: uuid("usage_id").references(() => aiUsage.id, { onDelete: "restrict" }),
    providerExecutionId: varchar("provider_execution_id", { length: 200 }),
    leaseToken: uuid("lease_token").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    safeErrorCode: varchar("safe_error_code", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("easy_mode_task_attempts_task_number_unique").on(table.taskId, table.attemptNumber),
    uniqueIndex("easy_mode_task_attempts_execution_key_unique").on(table.executionKey),
    uniqueIndex("easy_mode_task_attempts_usage_id_unique").on(table.usageId),
    uniqueIndex("easy_mode_task_attempts_one_active_per_run_unique")
      .on(table.runId)
      .where(sql`${table.status} in ('claimed','dispatching','running')`),
    index("easy_mode_task_attempts_run_idx").on(table.runId),
    index("easy_mode_task_attempts_task_idx").on(table.taskId),
    check("easy_mode_task_attempts_status_check", sql`${table.status} in ('claimed','dispatching','running','completed','failed_before_dispatch','failed_uncertain')`),
    check("easy_mode_task_attempts_attempt_number_check", sql`${table.attemptNumber} > 0`),
  ],
);
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

export type PublishedWebsiteStatus = "active" | "inactive";
export type WebsitePublicationAction = "publish" | "republish" | "unpublish" | "rollback";

export const publishedWebsites = pgTable(
  "published_websites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    projectId: text("project_id").notNull(),
    slug: varchar("slug", { length: 63 }).notNull(),
    status: varchar("status", { length: 16 }).$type<PublishedWebsiteStatus>().notNull().default("active"),
    template: varchar("template", { length: 32 }).notNull(),
    currentVersion: integer("current_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }).notNull(),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }).notNull(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("published_websites_slug_unique").on(table.slug),
    uniqueIndex("published_websites_project_unique").on(table.projectId),
    index("published_websites_owner_uid_idx").on(table.ownerUid),
  ],
);

export const websitePublicationVersions = pgTable(
  "website_publication_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publishedWebsiteId: uuid("published_website_id")
      .notNull()
      .references(() => publishedWebsites.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    action: varchar("action", { length: 16 }).$type<WebsitePublicationAction>().notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("website_publication_versions_site_version_unique").on(
      table.publishedWebsiteId,
      table.versionNumber,
    ),
    index("website_publication_versions_site_idx").on(table.publishedWebsiteId),
  ],
);

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
