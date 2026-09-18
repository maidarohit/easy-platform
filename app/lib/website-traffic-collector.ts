import "server-only";
import { parseWebsiteTraffic } from "@/app/lib/website-traffic";
import { resolveTrafficPublication, recordWebsiteTraffic } from "@/app/lib/website-traffic-server";
import { readLimitedJson, MalformedJsonBodyError, RequestBodyTooLargeError } from "@/app/lib/request-body";

export async function collectWebsiteTraffic(request: Request, dependencies = { resolve: resolveTrafficPublication, record: recordWebsiteTraffic }) {
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 403 });
  try {
    const event = parseWebsiteTraffic(await readLimitedJson(request, 4096));
    if (!event) return new Response(null, { status: 400 });
    const publication = await dependencies.resolve(event);
    if (!publication) return new Response(null, { status: 404 });
    const result = await dependencies.record(event, publication);
    return new Response(null, { status: result === 'limited' ? 429 : 204 });
  } catch (error) {
    return new Response(null, { status: error instanceof MalformedJsonBodyError ? 400 : error instanceof RequestBodyTooLargeError ? 413 : 503 });
  }
}
