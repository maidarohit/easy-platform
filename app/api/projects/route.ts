import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq, sql } from "drizzle-orm";
import { requirePaidEntitlement } from "@/app/lib/paid-entitlements";

export async function POST(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const body: Record<string, unknown> = await req.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!id || !name) {
      return NextResponse.json(
        { error: "Project id and name are required" },
        { status: 400 }
      );
    }

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
    };

    const [existingProject] = await db
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
      const entitlement = await requirePaidEntitlement(userId, "projects");
      if (!entitlement.ok) throw entitlement.response;
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
  } catch {
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

export async function DELETE(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Project id is required" },
        { status: 400 }
      );
    }

    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete project error:", error);

    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
