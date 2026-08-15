import { db } from "@/app/db";
import { aiManagerJobs, projectMemory, projects } from "@/app/db/schema";
import { and, eq } from "drizzle-orm";

const AI_MANAGER_WEBHOOK_URL =
  "https://rohitm2026.app.n8n.cloud/webhook/ai-manager";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function callbackBaseUrl() {
  const configuredUrl = text(
    process.env.AI_MANAGER_CALLBACK_BASE_URL
  ).replace(/\/+$/, "");

  if (!configuredUrl) {
    throw new Error(
      "AI_MANAGER_CALLBACK_BASE_URL is not configured."
    );
  }

  const url = new URL(configuredUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      "AI_MANAGER_CALLBACK_BASE_URL must use HTTP or HTTPS."
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export async function POST(req: Request) {
  let jobId = "";

  try {
    const body: Record<string, unknown> = await req.json();

    const projectId = text(body.projectId);
    const userId = text(body.userId);
    const companyName = text(body.companyName);
    const businessDescription = text(body.businessDescription);
    const industry = text(body.industry);
    const businessGoal = text(body.businessGoal);

    if (!userId) {
      return Response.json(
        { error: "Authentication is required." },
        { status: 401 }
      );
    }

    if (
      !companyName ||
      !businessDescription ||
      !industry ||
      !businessGoal
    ) {
      return Response.json(
        { error: "All business strategy fields are required." },
        { status: 400 }
      );
    }

    let memory = null;

    if (projectId) {
      const [ownedProject] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.userId, userId)
          )
        )
        .limit(1);

      if (!ownedProject) {
        return Response.json(
          { error: "Project not found." },
          { status: 404 }
        );
      }

      const [storedMemory] = await db
        .select()
        .from(projectMemory)
        .where(
          and(
            eq(projectMemory.projectId, projectId),
            eq(projectMemory.userId, userId)
          )
        )
        .limit(1);

      memory = storedMemory || null;
    }

    const callbackBase = callbackBaseUrl();

    const [job] = await db
      .insert(aiManagerJobs)
      .values({
        userId,
        projectId: projectId || null,
        status: "pending",
      })
      .returning({ id: aiManagerJobs.id });

    jobId = job.id;

    const callbackUrl =
      `${callbackBase}/api/ai-manager/jobs/${encodeURIComponent(jobId)}`;

    const payload = {
      projectId,
      userId,
      companyName,
      businessDescription,
      industry,
      businessGoal,
      analyticsContext: body.analyticsContext ?? null,
      projectMemory: memory,
      jobId,
      callbackUrl,
    };

    const response = await fetch(AI_MANAGER_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `AI Manager workflow request failed (${response.status}).`
      );
    }

    await db
      .update(aiManagerJobs)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiManagerJobs.id, jobId),
          eq(aiManagerJobs.status, "pending")
        )
      );

    return Response.json(
      {
        jobId,
        status: "processing",
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start AI Manager job.";

    if (jobId) {
      await db
        .update(aiManagerJobs)
        .set({
          status: "failed",
          error: message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiManagerJobs.id, jobId),
            eq(aiManagerJobs.status, "pending")
          )
        )
        .catch((updateError) =>
          console.error(
            "AI Manager job failure update error:",
            updateError
          )
        );
    }

    console.error("AI Manager job creation error:", error);

    return Response.json(
      {
        jobId: jobId || undefined,
        status: "failed",
        error: message,
      },
      { status: 500 }
    );
  }
}