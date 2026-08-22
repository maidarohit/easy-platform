import "server-only";

import { createHash, randomUUID } from "crypto";
import { isIP } from "net";
import { and, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "../db";
import { publicAiUsage } from "../db/schema";
import { calculateTokenCostUsd } from "./ai-cost";

const VISITOR_COOKIE = "easy_public_visitor";
const DEFAULT_DAILY_LIMIT = 2;
const DEFAULT_GLOBAL_DAILY_LIMIT = 50;
const SHORT_WINDOW_LIMIT = 2;
const SHORT_WINDOW_MS = 60_000;

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

export function getGlobalDailyLimit() {
  const configured = Number(
    process.env.PUBLIC_BUSINESS_IDEAS_GLOBAL_DAILY_LIMIT
  );

  if (!Number.isSafeInteger(configured) || configured < 1) {
    return DEFAULT_GLOBAL_DAILY_LIMIT;
  }

  return configured;
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

export function extractPublicClientIp(headers: Headers) {
  const headerNames = [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "x-real-ip",
  ] as const;

  for (const headerName of headerNames) {
    const value = headers.get(headerName);
    if (!value) continue;

    for (const candidate of value.split(",")) {
      const ip = candidate.trim();
      if (isIP(ip)) return ip;
    }
  }

  return null;
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

  return {
    visitorId,
    ipHash: hashIp(extractPublicClientIp(request.headers)),
  };
}

export async function reservePublicBusinessIdeaUsage(
  request: Request
) {
  const { visitorId, ipHash } = await getPublicVisitor(request);

  const startOfDay = getUtcDayStart();
  const shortWindowStart = new Date(Date.now() - SHORT_WINDOW_MS);
  const visitorLimit = getDailyLimit();
  const ipLimit = getIpDailyLimit();
  const globalLimit = getGlobalDailyLimit();

  return db.transaction(async (tx) => {
    /* Serialize the global check and reservation across all instances. */
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('public-business-ideas-global', 0))`
    );

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

    const [globalRow] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(publicAiUsage)
      .where(
        and(
          eq(publicAiUsage.module, "business-ideas"),
          gte(publicAiUsage.createdAt, startOfDay)
        )
      );

    if (Number(globalRow?.count ?? 0) >= globalLimit) {
      return {
        allowed: false as const,
        reason: "global-limit" as const,
        limit: visitorLimit,
        remaining: 0,
      };
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
      const [shortWindowRow] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(publicAiUsage)
        .where(
          and(
            eq(publicAiUsage.ipHash, ipHash),
            eq(publicAiUsage.module, "business-ideas"),
            gte(publicAiUsage.createdAt, shortWindowStart)
          )
        );

      if (Number(shortWindowRow?.count ?? 0) >= SHORT_WINDOW_LIMIT) {
        return {
          allowed: false as const,
          reason: "short-window-limit" as const,
          limit: visitorLimit,
          remaining: 0,
        };
      }

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
