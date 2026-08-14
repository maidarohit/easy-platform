import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  status: text("status").$type<AiManagerJobStatus>().notNull().default("pending"),
  result: text("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
