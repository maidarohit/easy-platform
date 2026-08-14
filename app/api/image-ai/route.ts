export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/image-ai",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("n8n error:", errorText);

      return Response.json(
        {
          error: "Image generation failed.",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();

    if (imageBuffer.byteLength === 0) {
      return Response.json(
        { error: "n8n returned an empty image." },
        { status: 500 }
      );
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(imageBuffer.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Image AI route error:", error);

    return Response.json(
      { error: "Image AI failed." },
      { status: 500 }
    );
  }
}