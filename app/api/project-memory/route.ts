import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projectMemory, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      projectId,
      businessName,
      industry,
      businessDescription,
      targetAudience,
      brandStyle,
      brandVoice,
      brandColors,
      typography,
      websiteGoal,
      marketingGoal,
      additionalContext,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existingMemory = await db
      .select()
      .from(projectMemory)
      .where(
        and(
          eq(projectMemory.projectId, projectId),
          eq(projectMemory.userId, userId)
        )
      );

    if (existingMemory.length > 0) {
      const [updatedMemory] = await db
        .update(projectMemory)
        .set({
          businessName,
          industry,
          businessDescription,
          targetAudience,
          brandStyle,
          brandVoice,
          brandColors,
          typography,
          websiteGoal,
          marketingGoal,
          additionalContext,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projectMemory.projectId, projectId),
            eq(projectMemory.userId, userId)
          )
        )
        .returning();

      return NextResponse.json({
        success: true,
        memory: updatedMemory,
      });
    }

    const [memory] = await db
      .insert(projectMemory)
      .values({
        projectId,
        userId,
        businessName,
        industry,
        businessDescription,
        targetAudience,
        brandStyle,
        brandVoice,
        brandColors,
        typography,
        websiteGoal,
        marketingGoal,
        additionalContext,
      })
      .returning();

    return NextResponse.json({
      success: true,
      memory,
    });
  } catch (error) {
    console.error("Project memory POST error:", error);

    return NextResponse.json(
      { error: "Failed to save project memory" },
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

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const memory = await db
      .select()
      .from(projectMemory)
      .where(
        and(
          eq(projectMemory.projectId, projectId),
          eq(projectMemory.userId, userId)
        )
      );

    return NextResponse.json({
      success: true,
      memory: memory[0] || null,
    });
  } catch (error) {
    console.error("Project memory GET error:", error);

    return NextResponse.json(
      { error: "Failed to load project memory" },
      { status: 500 }
    );
  }
}
