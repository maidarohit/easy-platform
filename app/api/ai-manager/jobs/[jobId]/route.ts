import { db } from "@/app/db";
import { aiManagerJobs } from "@/app/db/schema";
import { completeAiUsage, failAiUsage } from "@/app/lib/ai-usage";
import type { AiManagerOutput, AiManagerStrategy } from "@/app/lib/ai/types";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq, inArray } from "drizzle-orm";

const strategyKeys: Array<keyof AiManagerStrategy> = [
  "overview",
  "branding",
  "website",
  "marketing",
  "seo",
  "uiux",
  "sales",
  "analytics",
];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

function validOutput(value: unknown): value is AiManagerOutput {
  if (!isRecord(value)) return false;
  const output = value.output;
  if (!isRecord(output)) return false;
  return strategyKeys.every((key) => typeof output[key] === "string");
}

type JobRouteContext = { params: Promise<{ jobId: string }> };
type TerminalStatus = "completed" | "failed";

async function finalizeUsage(
  usageId: string | null,
  status: TerminalStatus,
  createdAt: Date
) {
  if (!usageId) return;

  try {
    const durationMs = Math.max(0, Date.now() - createdAt.getTime());

    if (status === "completed") {
      await completeAiUsage({ usageId, durationMs });
    } else {
      await failAiUsage({ usageId, durationMs });
    }
  } catch {
    console.error("AI Manager usage finalization failed.");
  }
}

export async function GET(request: Request, { params }: JobRouteContext) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { jobId } = await params;
  const [job] = await db
    .select()
    .from(aiManagerJobs)
    .where(and(eq(aiManagerJobs.id, jobId), eq(aiManagerJobs.userId, userId)))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  const response: Record<string, unknown> = { jobId: job.id, status: job.status };

  if (job.status === "completed" && job.result) {
    response.result = JSON.parse(job.result) as AiManagerOutput;
  }

  if (job.status === "failed") {
    response.error = job.error || "AI Manager job failed.";
  }

  return Response.json(response);
}

export async function POST(request: Request, { params }: JobRouteContext) {
  const configuredSecret = text(process.env.AI_MANAGER_CALLBACK_SECRET);
  const suppliedSecret = text(request.headers.get("authorization")).replace(/^Bearer\s+/i, "");

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized callback." }, { status: 401 });
  }

  const { jobId } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid callback body." }, { status: 400 });
  }

  if (!isRecord(body) || text(body.jobId) !== jobId) {
    return Response.json({ error: "Callback jobId does not match." }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(aiManagerJobs)
    .where(eq(aiManagerJobs.id, jobId))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  if (job.status === "completed" || job.status === "failed") {
    return Response.json({ jobId, status: job.status });
  }

  const outputIsValid = validOutput(body);
  const invalidOutput = body.status !== "failed" && !outputIsValid;
  const nextStatus: TerminalStatus = body.status === "failed" || invalidOutput
    ? "failed"
    : "completed";
  const error = body.status === "failed"
    ? text(body.error) || "AI Manager workflow failed."
    : invalidOutput
      ? "Invalid AI Manager result structure."
      : null;

  const [transitionedJob] = await db
    .update(aiManagerJobs)
    .set(
      nextStatus === "completed" && outputIsValid
        ? {
            status: "completed",
            result: JSON.stringify({ output: body.output }),
            error: null,
            updatedAt: new Date(),
          }
        : {
            status: "failed",
            result: null,
            error,
            updatedAt: new Date(),
          }
    )
    .where(
      and(
        eq(aiManagerJobs.id, jobId),
        inArray(aiManagerJobs.status, ["pending", "processing"])
      )
    )
    .returning({
      usageId: aiManagerJobs.usageId,
      createdAt: aiManagerJobs.createdAt,
      status: aiManagerJobs.status,
    });

  if (!transitionedJob) {
    const [terminalJob] = await db
      .select({ status: aiManagerJobs.status })
      .from(aiManagerJobs)
      .where(eq(aiManagerJobs.id, jobId))
      .limit(1);

    return Response.json({ jobId, status: terminalJob?.status || job.status });
  }

  await finalizeUsage(
    transitionedJob.usageId,
    transitionedJob.status as TerminalStatus,
    transitionedJob.createdAt
  );

  if (invalidOutput) {
    return Response.json(
      { jobId, status: "failed", error: "Invalid AI Manager result structure." },
      { status: 400 }
    );
  }

  return Response.json({ jobId, status: nextStatus });
}
