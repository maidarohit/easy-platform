import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/658e225f-8eca-47c7-b5d7-643d15deed25",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    console.log("N8N STATUS:", response.status);
    console.log("N8N RAW RESPONSE:", text);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "n8n request failed",
          n8nStatus: response.status,
          n8nResponse: text,
        },
        { status: response.status }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        {
          error: "n8n returned an empty response",
        },
        { status: 502 }
      );
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        {
          error: "n8n returned invalid JSON",
          n8nResponse: text,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("MARKETING API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong",
      },
      { status: 500 }
    );
  }
}