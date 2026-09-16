import { NextResponse } from "next/server";
import { authorizePlatformOwner, OWNER_COOKIE } from "@/app/lib/platform-analytics-owner";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const access = await authorizePlatformOwner(request);
  if (access.status !== 200) return new Response(null, { status: access.status });
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  // The signed Firebase token is verified again on every page request; never trust cookie presence.
  response.cookies.set(OWNER_COOKIE, request.headers.get("authorization")!.trim().split(/\s+/)[1], {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin",
    maxAge: Math.max(0, Math.min(3600, access.token.exp - Math.floor(Date.now() / 1000))),
  });
  return response;
}
