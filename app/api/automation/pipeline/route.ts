export async function POST(req: Request) {
  try {
    const body = await req.json();

    const n8nResponse = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/automation-pipeline",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const responseText = await n8nResponse.text();

    if (!n8nResponse.ok) {
      return new Response(
        responseText || "AI pipeline generation failed.",
        {
          status: n8nResponse.status,
        }
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("AI Pipeline API Error:", error);

    return Response.json(
      { error: "AI pipeline generation failed." },
      { status: 500 }
    );
  }
}