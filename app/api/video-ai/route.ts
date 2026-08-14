export async function POST(req: Request) {
  try {
    const body = await req.json();

    const n8nResponse = await fetch(
      "https://rohitm2026.app.n8n.cloud/webhook/video-ai",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();

      return new Response(errorText || "Video generation failed.", {
        status: n8nResponse.status,
      });
    }

    const video = await n8nResponse.arrayBuffer();

    if (video.byteLength === 0) {
      return new Response("n8n returned an empty video response.", {
        status: 502,
      });
    }

    return new Response(video, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Video API error:", error);

    return new Response("Something went wrong while generating the video.", {
      status: 500,
    });
  }
}