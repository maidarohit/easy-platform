import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/automation-content",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: text || "Content automation failed." },
        { status: response.status }
      );
    }

    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ content: text });
    }
  } catch (error) {
    console.error("Automation Content API Error:", error);

    return NextResponse.json(
      { error: "Failed to run content automation." },
      { status: 500 }
    );
  }
}