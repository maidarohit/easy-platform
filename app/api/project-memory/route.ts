import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projectMemory } from "@/app/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
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
    } = body;

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "projectId and userId are required" },
        { status: 400 }
      );
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
  try {
    const { searchParams } = new URL(req.url);

    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "projectId and userId are required" },
        { status: 400 }
      );
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