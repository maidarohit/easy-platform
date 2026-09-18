import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";
import { ownedWebsiteTraffic } from "@/app/lib/website-traffic-report";

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  let uid: string;
  try { uid = (await verifyFirebaseIdToken(request)).uid; }
  catch { return Response.json({ error: 'Authentication is required.' }, { status: 401, headers }); }
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim();
  if (!projectId || projectId.length > 200) return Response.json({ error: 'A project is required.' }, { status: 400, headers });
  try {
    const traffic = await ownedWebsiteTraffic(uid, projectId);
    return traffic ? Response.json({ traffic }, { headers }) : Response.json({ error: 'Project not found.' }, { status: 404, headers });
  } catch { return Response.json({ error: 'Website traffic is temporarily unavailable.' }, { status: 503, headers }); }
}
