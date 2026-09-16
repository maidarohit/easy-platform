import { authorizePlatformOwner } from "@/app/lib/platform-analytics-owner";
import { getPlatformAnalytics } from "@/app/lib/platform-analytics-report";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const access = await authorizePlatformOwner(request);
  if (access.status !== 200) return Response.json({ error: "Owner authorization required" }, { status: access.status, headers });
  try {
    return Response.json(await getPlatformAnalytics(), { headers });
  } catch {
    return Response.json({ error: "Platform analytics is temporarily unavailable." }, { status: 503, headers });
  }
}
