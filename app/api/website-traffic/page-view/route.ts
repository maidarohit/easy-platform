import { collectWebsiteTraffic } from "@/app/lib/website-traffic-collector";

export async function POST(request: Request) {
  return collectWebsiteTraffic(request);
}
