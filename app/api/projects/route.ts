import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq, inArray, sql } from "drizzle-orm";
import { allowanceError, checkUsageAllowance } from "@/app/lib/paid-entitlements";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import { validateProjectMutationBody } from "@/app/lib/project-request-validation";
import { supportedLanguageOrEnglish } from "@/app/lib/supported-languages";
import {
  aiManagerJobs,
  businessPublications,
  businessPublicationVersions,
  projectMemory,
  projectOutputs,
  publicBusinessInquiries,
  publicBusinessOrderItems,
  publicBusinessOrderPayments,
  publicBusinessOrders,
  publicBusinessPaymentEvents,
  publishedWebsites,
  websitePublicationVersions,
} from "@/app/db/schema";
import { handleProjectDelete } from "@/app/lib/project-deletion";
import { deleteBusinessProjectStorage } from "@/app/lib/firebase-admin-storage";

const MAX_PROJECT_BODY_BYTES = 32 * 1024;

export async function POST(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    const value = await readLimitedJson(req, MAX_PROJECT_BODY_BYTES);
    const validated = validateProjectMutationBody(value);
    if (!validated) {
      return NextResponse.json({ error: "Invalid project request" }, { status: 400 });
    }
    body = validated;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 });
    }
    if (error instanceof MalformedJsonBodyError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    throw error;
  }

  try {
    const { id, name } = body;
    const createOnly = body.creationIntent === "new-business";

    const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const optionalFields = {
      companyName: asText(body.companyName ?? body.name),
      industry: asText(body.industry),
      targetAudience: asText(body.targetAudience),
      goal: asText(body.goal ?? body.mainGoal),
      location: asText(body.location),
      businessStage: asText(body.businessStage),
      originalBrief: asText(body.originalBrief),
      brandStyle: asText(body.brandStyle),
      brandDescription: asText(body.businessDescription ?? body.brandDescription),
      result: asText(body.result),
      primaryLanguage: supportedLanguageOrEnglish(body.primaryLanguage),
    };

    const [existingProject] = createOnly ? [] : await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.name, name)))
      .limit(1);

    if (existingProject) {
      const suppliedFields = Object.fromEntries(
        Object.entries(optionalFields).filter(([key]) => {
          if (key === "goal") return body.goal !== undefined || body.mainGoal !== undefined;
          if (key === "brandDescription") return body.brandDescription !== undefined || body.businessDescription !== undefined;
          return body[key] !== undefined;
        }),
      );

      const [project] = await db
        .update(projects)
        .set({ ...suppliedFields, updatedAt: new Date() })
        .where(and(eq(projects.id, existingProject.id), eq(projects.userId, userId)))
        .returning();

      return NextResponse.json({ success: true, project, updated: true });
    }

    const project = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${userId}:projects`}))`
      );
      const [projectCount] = await transaction
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.userId, userId));
      const hasNoProjects = Number(projectCount?.count ?? 0) === 0;
      const allowance = await checkUsageAllowance(userId, "projects");
      const mayCreateInitialProject =
        hasNoProjects &&
        !allowance.ok &&
        allowance.reason === "PAID_SUBSCRIPTION_REQUIRED";

      if (!allowance.ok && !mayCreateInitialProject) {
        throw allowanceError(allowance);
      }
      const [createdProject] = await transaction
        .insert(projects)
        .values({ id, userId, name, ...optionalFields })
        .returning();
      return createdProject;
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Create project error:", error);

    const detail = error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development"
          ? `Failed to create project: ${detail}`
          : "Failed to create project",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch (error) {
  console.error("PROJECTS_GET_AUTH_ERROR:", error);
  return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
}

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, project });
    }

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    return NextResponse.json({
      success: true,
      projects: userProjects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json(
      { error: "Authentication is required" },
      { status: 401 },
    );
  }

  try {
    const value = await readLimitedJson(req, MAX_PROJECT_BODY_BYTES);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const body = value as Record<string, unknown>;

    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";

    const updates: Partial<typeof projects.$inferInsert> = {};

if (typeof body.primaryLanguage === "string") {
  updates.primaryLanguage = supportedLanguageOrEnglish(body.primaryLanguage);
}

if (typeof body.companyName === "string") {
  updates.companyName = body.companyName.trim();
}

if (typeof body.industry === "string") {
  updates.industry = body.industry.trim();
}

if (typeof body.goal === "string") {
  updates.goal = body.goal.trim();
}

if (typeof body.brandStyle === "string") {
  updates.brandStyle = body.brandStyle.trim();
}

if (typeof body.brandDescription === "string") {
  updates.brandDescription = body.brandDescription.trim();
}

if (typeof body.result === "string") {
  updates.result = body.result;
}

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updates)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
        ),
      )
      .returning({
        id: projects.id,
        primaryLanguage: projects.primaryLanguage,
      });

    if (!updatedProject) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      project: updatedProject,
    });
  } catch (error) {
    console.error("Update project language error:", error);

    return NextResponse.json(
      { error: "Failed to update project language" },
      { status: 500 },
    );
  }
}
export async function DELETE(req: Request) {
  return handleProjectDelete(req, {
    verify: verifyFirebaseIdToken,
    deleteProjectStorage: deleteBusinessProjectStorage,
    deleteOwnedProject: async ({ userId, projectId, confirmationName }) => db.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`${userId}:projects`}))`);
      const [project] = await transaction.select({ id: projects.id, name: projects.name, companyName: projects.companyName })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1)
        .for("update");
      if (!project) return "not_found" as const;
      const businessName = project.companyName?.trim() || project.name.trim();
      if (businessName !== confirmationName) return "confirmation_mismatch" as const;

      const orders = await transaction.select({ id: publicBusinessOrders.id })
        .from(publicBusinessOrders)
        .where(eq(publicBusinessOrders.projectId, projectId));
      const orderIds = orders.map((order) => order.id);
      if (orderIds.length > 0) {
        await transaction.delete(publicBusinessPaymentEvents).where(inArray(publicBusinessPaymentEvents.orderId, orderIds));
        await transaction.delete(publicBusinessOrderPayments).where(inArray(publicBusinessOrderPayments.orderId, orderIds));
        await transaction.delete(publicBusinessOrderItems).where(inArray(publicBusinessOrderItems.orderId, orderIds));
        await transaction.delete(publicBusinessOrders).where(inArray(publicBusinessOrders.id, orderIds));
      }

      const publications = await transaction.select({ id: businessPublications.id })
        .from(businessPublications).where(and(eq(businessPublications.projectId, projectId), eq(businessPublications.userId, userId)));
      const publicationIds = publications.map((publication) => publication.id);
      if (publicationIds.length > 0) {
        await transaction.delete(publicBusinessInquiries).where(inArray(publicBusinessInquiries.publicationId, publicationIds));
        await transaction.delete(businessPublicationVersions).where(inArray(businessPublicationVersions.publicationId, publicationIds));
        await transaction.delete(businessPublications).where(inArray(businessPublications.id, publicationIds));
      }

      const websites = await transaction.select({ id: publishedWebsites.id })
        .from(publishedWebsites).where(and(eq(publishedWebsites.projectId, projectId), eq(publishedWebsites.ownerUid, userId)));
      const websiteIds = websites.map((website) => website.id);
      if (websiteIds.length > 0) {
        await transaction.delete(websitePublicationVersions).where(inArray(websitePublicationVersions.publishedWebsiteId, websiteIds));
        await transaction.delete(publishedWebsites).where(inArray(publishedWebsites.id, websiteIds));
      }

      await transaction.delete(aiManagerJobs).where(and(eq(aiManagerJobs.projectId, projectId), eq(aiManagerJobs.userId, userId)));
      await transaction.delete(projectMemory).where(and(eq(projectMemory.projectId, projectId), eq(projectMemory.userId, userId)));
      await transaction.delete(projectOutputs).where(and(eq(projectOutputs.projectId, projectId), eq(projectOutputs.userId, userId)));
      const [deleted] = await transaction.delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .returning({ id: projects.id });
      return deleted ? "deleted" as const : "not_found" as const;
    }),
  });
}
