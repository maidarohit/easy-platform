import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projectOutputs, projects } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq } from "drizzle-orm";
import {
  MalformedJsonBodyError,
  readLimitedJson,
  RequestBodyTooLargeError,
} from "@/app/lib/request-body";
import { validateProjectOutputBody } from "@/app/lib/project-request-validation";

const MAX_PROJECT_OUTPUT_BODY_BYTES = 256 * 1024;

/*
  SAVE OR UPDATE MODULE OUTPUT
*/
export async function POST(req: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  let body: { projectId: string; module: string; result: string };
  try {
    const value = await readLimitedJson(req, MAX_PROJECT_OUTPUT_BODY_BYTES);
    const validated = validateProjectOutputBody(value);
    if (!validated) {
      return NextResponse.json({ error: "Invalid project output request" }, { status: 400 });
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
    const projectId = body.projectId;
    const moduleName = body.module.toLowerCase();
    const result = body.result;

    const [ownedProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!ownedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [existingOutput] = await db
      .select()
      .from(projectOutputs)
      .where(
        and(
          eq(projectOutputs.projectId, projectId),
          eq(projectOutputs.userId, userId),
          eq(projectOutputs.module, moduleName)
        )
      )
      .limit(1);

    if (existingOutput) {
      const [updatedOutput] = await db
        .update(projectOutputs)
        .set({
          result,
          approvedAt: null,
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
        module: moduleName,
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
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(req)).uid;
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);

    const projectId = searchParams.get("projectId")?.trim() || "";
    const moduleName = searchParams.get("module")?.trim().toLowerCase() || "";

    if (!projectId) {
      return NextResponse.json(
        {
          error: "projectId is required",
        },
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

    if (moduleName) {
      const [output] = await db
        .select()
        .from(projectOutputs)
        .where(
          and(
            eq(projectOutputs.projectId, projectId),
            eq(projectOutputs.userId, userId),
            eq(projectOutputs.module, moduleName)
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
