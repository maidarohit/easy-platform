import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/dff50e4b-b682-4001-aa03-f83ef3abf782",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }, 
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();

    console.log("STATUS:", response.status);
    console.log("RAW:", text);

    // Parse the response from n8n
    const data = JSON.parse(text);

    // Return ONLY the data
    return NextResponse.json(data);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}