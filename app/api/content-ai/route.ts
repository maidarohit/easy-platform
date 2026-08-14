export async function POST(req: Request) {
  try {
    const body = await req.json();

    const n8nResponse = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/content-ai",
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
      return new Response(responseText || "Content generation failed.", {
        status: n8nResponse.status,
      });
    }

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Content AI API error:", error);

    return new Response(
      JSON.stringify({
        error: "Something went wrong while generating content.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}