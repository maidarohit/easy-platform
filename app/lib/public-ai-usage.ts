import "server-only";

import { createHash, randomUUID } from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "../db";
import { publicAiUsage } from "../db/schema";
import { calculateTokenCostUsd } from "./ai-cost";

const VISITOR_COOKIE = "easy_public_visitor";
const DEFAULT_DAILY_LIMIT = 2;

function getDailyLimit() {
  const value = Number(
    process.env.PUBLIC_AI_DAILY_LIMIT || DEFAULT_DAILY_LIMIT
  );

  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_DAILY_LIMIT;
  }

  return Math.floor(value);
}

function getIpDailyLimit() {
  const configured = Number(process.env.PUBLIC_AI_IP_DAILY_LIMIT);

  if (Number.isFinite(configured) && configured >= 1) {
    return Math.floor(configured);
  }

  return getDailyLimit() * 3;
}

function getUtcDayStart() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function hashIp(ip: string | null) {
  const secret = process.env.PUBLIC_AI_IP_HASH_SECRET;

  if (!secret) {
    throw new Error(
      "PUBLIC_AI_IP_HASH_SECRET is not configured."
    );
  }

  if (!ip) return null;

  return createHash("sha256")
    .update(`${secret}:${ip}`)
    .digest("hex");
}

async function getPublicVisitor(request: Request) {
  const cookieStore = await cookies();

  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;

  if (!visitorId) {
    visitorId = randomUUID();

    cookieStore.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  return {
    visitorId,
    ipHash: hashIp(ip),
  };
}

export async function reservePublicBusinessIdeaUsage(
  request: Request
) {
  const { visitorId, ipHash } = await getPublicVisitor(request);

  const startOfDay = getUtcDayStart();
  const visitorLimit = getDailyLimit();
  const ipLimit = getIpDailyLimit();

  return db.transaction(async (tx) => {
    /*
     * Serialize requests from the same browser.
     * This prevents rapid/concurrent requests from checking the
     * same old count before either one inserts its usage row.
     */
    await tx.execute(
      sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`visitor:${visitorId}`}, 0)
        )
      `
    );

    /*
     * Also serialize requests sharing the same IP hash.
     * This provides secondary protection if cookies are cleared.
     */
    if (ipHash) {
      await tx.execute(
        sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`ip:${ipHash}`}, 0)
          )
        `
      );
    }

    const visitorRows = await tx
      .select({
        count: sql<number>`count(*)`,
      })
      .from(publicAiUsage)
      .where(
        and(
          eq(publicAiUsage.visitorId, visitorId),
          eq(publicAiUsage.module, "business-ideas"),
          gte(publicAiUsage.createdAt, startOfDay)
        )
      );

    const visitorCount = Number(
      visitorRows[0]?.count || 0
    );

    if (visitorCount >= visitorLimit) {
      return {
        allowed: false as const,
        reason: "visitor-limit" as const,
        limit: visitorLimit,
        remaining: 0,
      };
    }

    if (ipHash) {
      const ipRows = await tx
        .select({
          count: sql<number>`count(*)`,
        })
        .from(publicAiUsage)
        .where(
          and(
            eq(publicAiUsage.ipHash, ipHash),
            eq(publicAiUsage.module, "business-ideas"),
            gte(publicAiUsage.createdAt, startOfDay)
          )
        );

      const ipCount = Number(ipRows[0]?.count || 0);

      if (ipCount >= ipLimit) {
        return {
          allowed: false as const,
          reason: "ip-limit" as const,
          limit: visitorLimit,
          remaining: 0,
        };
      }
    }

    const [usage] = await tx
      .insert(publicAiUsage)
      .values({
        visitorId,
        ipHash,
        module: "business-ideas",
        workflow: "openai-responses",
        model: "gpt-5-mini",
        requestCount: 1,
        status: "started",
      })
      .returning({
        id: publicAiUsage.id,
      });

    if (!usage) {
      throw new Error(
        "Could not initialize public AI usage."
      );
    }

    return {
      allowed: true as const,
      usageId: usage.id,
      limit: visitorLimit,
      remaining: Math.max(
        visitorLimit - visitorCount - 1,
        0
      ),
    };
  });
}

export async function completePublicAiUsage({
  usageId,
  durationMs,
  inputTokens,
  outputTokens,
  model,
}: {
  usageId: string;
  durationMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
}) {
  const resolvedModel = model ?? "gpt-5-mini";
  const estimatedCostUsd =
    typeof inputTokens === "number" &&
    typeof outputTokens === "number"
      ? calculateTokenCostUsd({
          model: resolvedModel,
          inputTokens,
          outputTokens,
        })
      : "0";

  await db
    .update(publicAiUsage)
    .set({
      durationMs,
      inputTokens: inputTokens ?? null,
      outputTokens: outputTokens ?? null,
      model: resolvedModel,
      estimatedCostUsd,
      status: "success",
    })
    .where(
      and(
        eq(publicAiUsage.id, usageId),
        eq(publicAiUsage.status, "started")
      )
    );
}

export async function failPublicAiUsage({
  usageId,
  durationMs,
}: {
  usageId: string;
  durationMs: number;
}) {
  await db
    .update(publicAiUsage)
    .set({
      durationMs,
      status: "failed",
    })
    .where(
      and(
        eq(publicAiUsage.id, usageId),
        eq(publicAiUsage.status, "started")
      )
    );
}
