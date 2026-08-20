import { db } from "@/app/db";
import { aiManagerJobs, aiUsage } from "@/app/db/schema";
import { AI_MODULES } from "@/app/lib/ai/registry";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { and, eq, inArray, sql } from "drizzle-orm";

export async function GET(request: Request) {
  let userId: string;

  try {
    userId = (await verifyFirebaseIdToken(request)).uid;
  } catch {
    return Response.json(
      { error: "Authentication is required." },
      { status: 401 }
    );
  }

  try {
    const [usageRow, activeJobsRow] = await Promise.all([
      db
        .select({
          count: sql<number>`coalesce(sum(${aiUsage.requestCount}), 0)`,
        })
        .from(aiUsage)
        .where(eq(aiUsage.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(aiManagerJobs)
        .where(
          and(
            eq(aiManagerJobs.userId, userId),
            inArray(aiManagerJobs.status, ["pending", "processing"])
          )
        ),
    ]);

    return Response.json({
      aiRequests: Number(usageRow[0]?.count ?? 0),
      availableAiTools: AI_MODULES.length,
      activeAiJobs: Number(activeJobsRow[0]?.count ?? 0),
    });
  } catch {
    console.error("Dashboard summary failed.");
    return Response.json(
      { error: "Dashboard summary is temporarily unavailable." },
      { status: 500 }
    );
  }
}
