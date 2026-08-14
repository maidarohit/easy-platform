const BRANDING_AI_WEBHOOK =
  "https://rohitm2026.app.n8n.cloud/webhook/branding-api";

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const body: unknown = await request.json();
    const upstream = await fetch(BRANDING_AI_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const responseText = await upstream.text();

    if (!upstream.ok) {
      return new Response(responseText || "Branding AI request failed.", {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!responseText) {
      return Response.json(
        { error: "Branding AI returned an empty response." },
        { status: 502 }
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Branding AI API error:", error);
    return Response.json({ error: "Branding AI failed." }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
