import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/analytics-ai",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    console.log("Analytics Status:", response.status);
    console.log("Analytics Raw Response:", text);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Analytics AI workflow failed.",
          details: text,
        },
        { status: response.status }
      );
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        result: text,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Analytics API Error:", error);

    return NextResponse.json(
      {
        error: "Analytics AI failed.",
      },
      { status: 500 }
    );
  }
}