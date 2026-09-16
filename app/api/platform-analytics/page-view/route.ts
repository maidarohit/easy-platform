import { sql } from "drizzle-orm";
import { db } from "@/app/db";
import { platformPageViews } from "@/app/db/schema";
import { parsePageView } from "@/app/lib/platform-analytics";
import { readLimitedJson, RequestBodyTooLargeError, MalformedJsonBodyError } from "@/app/lib/request-body";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      !request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 403 });
  }
  try {
    const event = parsePageView(await readLimitedJson(request, 8192));
    if (!event) return new Response(null, { status: 400 });
    const accepted = await db.transaction(async (tx) => {
      // Database locking keeps the per-session limit effective across instances.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.sessionId}))`);
      const [rate] = await tx.execute<{ count: number }>(sql`
        select count(*)::int as count from platform_page_views
        where session_id = ${event.sessionId}::uuid and created_at >= now() - interval '1 minute'
      `);
      if (rate.count >= 60) return false;
      await tx.insert(platformPageViews).values(event);
      return true;
    });
    return new Response(null, { status: accepted ? 204 : 429 });
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : error instanceof MalformedJsonBodyError ? 400 : 503;
    return new Response(null, { status });
  }
}
