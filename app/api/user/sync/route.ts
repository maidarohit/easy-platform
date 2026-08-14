import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, email } = body;

    if (!id || !email) {
      return NextResponse.json(
        { error: "User ID and email are required" },
        { status: 400 }
      );
    }

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