import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/afe45d44-0079-4e61-8631-7b72059f5e17",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    console.log("N8N Response:", text);

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to contact Sales AI" },
      { status: 500 }
    );
  }
}