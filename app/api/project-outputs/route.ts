import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projectOutputs } from "@/app/db/schema";
import { and, eq } from "drizzle-orm";

const asText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function serializeResult(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === undefined || value === null) {
    return "";
  }

  return JSON.stringify(value);
}

/*
  SAVE OR UPDATE MODULE OUTPUT
*/
export async function POST(req: Request) {
  try {
    const body: Record<string, unknown> = await req.json();

    const projectId = asText(body.projectId);
    const userId = asText(body.userId);
    const module = asText(body.module).toLowerCase();
    const result = serializeResult(body.result);

    if (!projectId || !userId || !module || !result) {
      return NextResponse.json(
        {
          error: "projectId, userId, module and result are required",
        },
        { status: 400 }
      );
    }

    const [existingOutput] = await db
      .select()
      .from(projectOutputs)
      .where(
        and(
          eq(projectOutputs.projectId, projectId),
          eq(projectOutputs.userId, userId),
          eq(projectOutputs.module, module)
        )
      )
      .limit(1);

    if (existingOutput) {
      const [updatedOutput] = await db
        .update(projectOutputs)
        .set({
          result,
          updatedAt: new Date(),
        })
        .where(eq(projectOutputs.id, existingOutput.id))
        .returning();

      return NextResponse.json({
        success: true,
        output: updatedOutput,
        updated: true,
      });
    }

    const [output] = await db
      .insert(projectOutputs)
      .values({
        projectId,
        userId,
        module,
        result,
      })
      .returning();

    return NextResponse.json({
      success: true,
      output,
      created: true,
    });
  } catch (error) {
    console.error("Save project output error:", error);

    return NextResponse.json(
      {
        error: "Failed to save project output",
      },
      { status: 500 }
    );
  }
}

/*
  LOAD PROJECT OUTPUTS
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const projectId = searchParams.get("projectId")?.trim() || "";
    const userId = searchParams.get("userId")?.trim() || "";
    const module = searchParams.get("module")?.trim().toLowerCase() || "";

    if (!projectId || !userId) {
      return NextResponse.json(
        {
          error: "projectId and userId are required",
        },
        { status: 400 }
      );
    }

    if (module) {
      const [output] = await db
        .select()
        .from(projectOutputs)
        .where(
          and(
            eq(projectOutputs.projectId, projectId),
            eq(projectOutputs.userId, userId),
            eq(projectOutputs.module, module)
          )
        )
        .limit(1);

      return NextResponse.json({
        success: true,
        output: output || null,
      });
    }

    const outputs = await db
      .select()
      .from(projectOutputs)
      .where(
        and(
          eq(projectOutputs.projectId, projectId),
          eq(projectOutputs.userId, userId)
        )
      );

    return NextResponse.json({
      success: true,
      outputs,
    });
  } catch (error) {
    console.error("Load project outputs error:", error);

    return NextResponse.json(
      {
        error: "Failed to load project outputs",
      },
      { status: 500 }
    );
  }
}