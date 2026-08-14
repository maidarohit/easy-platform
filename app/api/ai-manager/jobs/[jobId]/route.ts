import { db } from "@/app/db";
import { aiManagerJobs } from "@/app/db/schema";
import type { AiManagerOutput, AiManagerStrategy } from "@/app/lib/ai";
import { and, eq } from "drizzle-orm";

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

export async function GET(req: Request, { params }: JobRouteContext) {
  const { jobId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = text(searchParams.get("userId"));

  if (!userId) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

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

export async function POST(req: Request, { params }: JobRouteContext) {
  const configuredSecret = text(process.env.AI_MANAGER_CALLBACK_SECRET);
  const suppliedSecret = text(req.headers.get("authorization")).replace(/^Bearer\s+/i, "");

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return Response.json({ error: "Unauthorized callback." }, { status: 401 });
  }

  const { jobId } = await params;
  const body: unknown = await req.json();

  if (!isRecord(body) || text(body.jobId) !== jobId) {
    return Response.json({ error: "Callback jobId does not match." }, { status: 400 });
  }

  const [job] = await db
    .select({ id: aiManagerJobs.id })
    .from(aiManagerJobs)
    .where(eq(aiManagerJobs.id, jobId))
    .limit(1);

  if (!job) {
    return Response.json({ error: "AI Manager job not found." }, { status: 404 });
  }

  if (body.status === "failed") {
    const error = text(body.error) || "AI Manager workflow failed.";
    await db
      .update(aiManagerJobs)
      .set({ status: "failed", result: null, error, updatedAt: new Date() })
      .where(eq(aiManagerJobs.id, jobId));

    return Response.json({ jobId, status: "failed" });
  }

  if (!validOutput(body)) {
    return Response.json({ error: "Invalid AI Manager result structure." }, { status: 400 });
  }

  await db
    .update(aiManagerJobs)
    .set({
      status: "completed",
      result: JSON.stringify({ output: body.output }),
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(aiManagerJobs.id, jobId));

  return Response.json({ jobId, status: "completed" });
}
