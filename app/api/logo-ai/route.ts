import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const body = await req.json();

    console.log("Logo AI request received:", body);

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/logo-ai",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const rawResponse = await response.text();

    console.log("n8n status:", response.status);
    console.log("n8n raw response:", rawResponse);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `n8n request failed with status ${response.status}`,
          details: rawResponse,
        },
        { status: response.status }
      );
    }

    if (!rawResponse) {
      return NextResponse.json(
        { error: "n8n returned an empty response." },
        { status: 502 }
      );
    }

    let data;

    try {
      data = JSON.parse(rawResponse);
    } catch {
      return NextResponse.json(
        {
          error: "n8n returned invalid JSON.",
          details: rawResponse,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Logo AI route error:", error);

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Logo AI timed out after 60 seconds." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Logo AI failed." },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}