import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { verifyFirebaseIdToken } from "@/app/lib/firebase-admin";

export async function POST(req: Request) {
  let id: string;
  let email: string;

  try {
    const verifiedToken = await verifyFirebaseIdToken(req);
    id = verifiedToken.uid;
    email = typeof verifiedToken.email === "string" ? verifiedToken.email.trim() : "";
  } catch {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Authenticated email is required" },
      { status: 400 }
    );
  }

  try {
    await db
      .insert(users)
      .values({
        id,
        email,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User sync error:", error);

    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
